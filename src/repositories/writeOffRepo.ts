import { createClient } from "@/lib/supabase/server";
import { applyStockMovementBatch } from "@/services/stockMovementService";
import type { WriteOff } from "@/types";

export async function getWriteOffs(orgId: string): Promise<WriteOff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("write_offs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createWriteOff(wo: Omit<WriteOff, "id" | "created_at">): Promise<WriteOff> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("write_offs")
    .insert(wo)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createWriteOffWithStock(
  orgId: string,
  wo: Omit<WriteOff, "id" | "created_at">
): Promise<WriteOff> {
  if (!Number.isInteger(wo.quantity) || wo.quantity <= 0) {
    throw new Error("Write-off quantity must be a whole number greater than zero");
  }

  const productRepo = await import("@/repositories/productRepo");
  const levels = await productRepo.getStockLevels(orgId, wo.product_id);
  const atLocation = levels.find(
    (s) => s.location_type === wo.location_type && s.location_id === wo.location_id
  );
  const available = atLocation?.quantity ?? 0;
  if (available <= 0) {
    throw new Error("No stock at this location — nothing to write off");
  }

  // Never drive stock negative: record the write-off for at most what's on
  // hand (e.g. request 5 of 3 -> writes off 3, stock lands on 0).
  const actualQuantity = Math.min(wo.quantity, available);
  const result = await createWriteOff({ ...wo, quantity: actualQuantity });
  await applyStockMovementBatch(orgId, [
    {
      product_id: wo.product_id,
      quantity: actualQuantity,
      from_location_type: wo.location_type,
      from_location_id: wo.location_id,
      note: "write_off",
    },
  ]);
  return result;
}