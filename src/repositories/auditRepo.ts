import { createClient } from "@/lib/supabase/server";
import type { Audit } from "@/types";

export async function getAudits(orgId: string): Promise<Audit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAudit(id: string): Promise<Audit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createAudit(audit: Omit<Audit, "id" | "created_at">): Promise<Audit> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .insert(audit)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAudit(id: string, updates: Partial<Audit>): Promise<Audit> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function generateCountSheet(
  orgId: string,
  locationType: "WAREHOUSE" | "SITE",
  locationId: string,
  category?: string
): Promise<{ product_id: string; expected: number; actual: number | null }[]> {
  const { getAllStockLevels } = await import("@/repositories/productRepo");
  const levels = await getAllStockLevels(orgId);
  let rows = levels.filter(
    (l) => l.location_type === locationType && l.location_id === locationId && Number(l.quantity) > 0
  );
  if (category) {
    const { getProducts } = await import("@/repositories/productRepo");
    const products = await getProducts(orgId);
    const catByProduct = new Map(products.map((p) => [p.id, p.category]));
    rows = rows.filter((l) => (catByProduct.get(l.product_id) ?? null) === category);
  }
  return rows.map((l) => ({ product_id: l.product_id, expected: Number(l.quantity), actual: null }));
}

export async function completeAuditWithAdjustments(
  orgId: string,
  auditId: string,
  counts: { product_id: string; actual: number }[],
  locationType: "WAREHOUSE" | "SITE",
  locationId: string,
  approvedBy: string
): Promise<Audit> {
  const audit = await getAudit(auditId);
  if (!audit) throw new Error("Audit not found");

  const productRepo = await import("@/repositories/productRepo");

  // Build final count_sheet + discrepancies
  const existing = audit.count_sheet || [];
  const actualMap = new Map(counts.map((c) => [c.product_id, c.actual]));
  const finalSheet = existing
    .filter((row) => actualMap.has(row.product_id))
    .map((row) => ({ ...row, actual: actualMap.get(row.product_id) ?? row.expected }));

  const discrepancies = finalSheet
    .filter((row) => row.actual !== null && row.actual !== undefined && Number(row.actual) !== Number(row.expected))
    .map((row) => ({
      product_id: row.product_id,
      expected: Number(row.expected),
      actual: Number(row.actual),
      diff: Number(row.actual) - Number(row.expected),
    }));

  // Apply adjustments to stock levels
  for (const row of finalSheet) {
    if (row.actual === null) continue;
    const expected = Number(row.expected);
    const actual = Number(row.actual);
    if (actual !== expected) {
      await productRepo.upsertStockLevel(orgId, row.product_id, locationType, locationId, actual - expected);
    }
  }

  return updateAudit(auditId, {
    status: "COMPLETED",
    count_sheet: finalSheet,
    discrepancies,
    approved_by: approvedBy,
    completed_at: new Date().toISOString(),
  });
}