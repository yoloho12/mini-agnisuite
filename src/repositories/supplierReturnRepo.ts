import { createClient } from "@/lib/supabase/server";
import { generateSupplierReturnNumber } from "@/lib/numberGen";
import { applyStockMovementBatch } from "@/services/stockMovementService";
import type { SupplierReturn } from "@/types";

export async function getSupplierReturns(orgId: string): Promise<SupplierReturn[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_returns")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSupplierReturn(id: string): Promise<SupplierReturn | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_returns")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSupplierReturn(returnData: Omit<SupplierReturn, "id" | "created_at">): Promise<SupplierReturn> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_returns")
    .insert(returnData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getNextSupplierReturnSeq(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_returns")
    .select("return_number")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (data?.length) {
    const match = data[0].return_number.match(/(\d+)$/);
    if (match) return Number(match[1]) + 1;
  }
  return 1;
}

export async function countSupplierReturns(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("supplier_returns")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) throw error;
  return count || 0;
}

export async function createSupplierReturnWithStock(
  orgId: string,
  supplierId: string,
  warehouseId: string,
  reason: string,
  items: { product_id: string; quantity: number; unit_cost_mmk: number }[]
): Promise<SupplierReturn> {
  if (!supplierId || !warehouseId || !reason.trim()) {
    throw new Error("Supplier, warehouse and reason are required");
  }
  if (items.length === 0) {
    throw new Error("Add at least one product to return");
  }

  // A supplier return only makes sense for goods we actually bought from
  // that supplier, and only for what's still in stock at that warehouse.
  const poRepo = await import("@/repositories/poRepo");
  const productRepo = await import("@/repositories/productRepo");
  const purchased = await poRepo.getSupplierPurchasedProducts(orgId, supplierId);
  const purchasedSet = new Set(purchased.map((p) => p.product_id));

  const aggregated = new Map<string, number>();
  const unitCosts = new Map<string, number>();
  for (const item of items) {
    if (!item.product_id) throw new Error("Each return line needs a product");
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Return quantity must be a whole number greater than zero");
    }
    if (!purchasedSet.has(item.product_id)) {
      const product = await productRepo.getProduct(item.product_id);
      throw new Error(
        `"${product?.name ?? item.product_id}" was not purchased from this supplier`
      );
    }
    aggregated.set(item.product_id, (aggregated.get(item.product_id) ?? 0) + item.quantity);
    if (!unitCosts.has(item.product_id)) {
      unitCosts.set(item.product_id, item.unit_cost_mmk || 0);
    }
  }

  const shortages: string[] = [];
  for (const [productId, qty] of aggregated) {
    const levels = await productRepo.getStockLevels(orgId, productId);
    const available =
      levels.find((s) => s.location_type === "WAREHOUSE" && s.location_id === warehouseId)
        ?.quantity ?? 0;
    if (qty > available) {
      const product = await productRepo.getProduct(productId);
      shortages.push(`${product?.name ?? productId} (needs ${qty}, has ${available})`);
    }
  }
  if (shortages.length > 0) {
    throw new Error(`Insufficient stock at warehouse to return: ${shortages.join("; ")}`);
  }

  const mergedItems = [...aggregated.entries()].map(([product_id, quantity]) => ({
    product_id,
    quantity,
    unit_cost_mmk: unitCosts.get(product_id) ?? 0,
  }));

  const seq = (await countSupplierReturns(orgId)) + 1;
  const r = await createSupplierReturn({
    org_id: orgId,
    supplier_id: supplierId,
    warehouse_id: warehouseId,
    return_number: generateSupplierReturnNumber(seq),
    reason,
    status: "RETURNED",
    items: mergedItems,
    created_by: "",
  });

  await applyStockMovementBatch(
    orgId,
    mergedItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      from_location_type: "WAREHOUSE",
      from_location_id: warehouseId,
      note: "supplier_return",
    }))
  );

  return r;
}