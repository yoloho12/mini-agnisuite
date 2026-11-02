import { createClient } from "@/lib/supabase/server";
import type { StockLevel } from "@/types";

export type StockLocationType = "WAREHOUSE" | "SITE";

export interface StockMovementDelta {
  product_id: string;
  quantity: number;
  from_location_type?: StockLocationType | null;
  from_location_id?: string | null;
  to_location_type?: StockLocationType | null;
  to_location_id?: string | null;
  note?: string | null;
}

export interface StockMovementValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateStockMovementPlan(
  plan: StockMovementDelta[],
  currentLevels: Pick<StockLevel, "product_id" | "location_type" | "location_id" | "quantity">[]
): StockMovementValidationResult {
  if (!Array.isArray(plan) || plan.length === 0) {
    return { ok: false, reason: "Movement plan is empty." };
  }

  const requiredBySource = new Map<string, number>();

  for (const entry of plan) {
    if (!entry.product_id) {
      return { ok: false, reason: "Every movement needs a product id." };
    }

    const quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      return {
        ok: false,
        reason: `Movement quantity for product ${entry.product_id} must be a positive whole number.`,
      };
    }

    if (entry.from_location_type && entry.from_location_id) {
      const key = `${entry.product_id}:${entry.from_location_type}:${entry.from_location_id}`;
      requiredBySource.set(key, (requiredBySource.get(key) ?? 0) + quantity);
    }
  }

  for (const [key, requiredQty] of requiredBySource.entries()) {
    const [productId, locationType, locationId] = key.split(":");
    const current = currentLevels.find(
      (level) =>
        level.product_id === productId &&
        level.location_type === locationType &&
        level.location_id === locationId
    );

    const available = Number(current?.quantity ?? 0);
    if (available < requiredQty) {
      return {
        ok: false,
        reason: `Insufficient stock for product ${productId} at ${locationType} ${locationId}. Needed ${requiredQty}, available ${available}.`,
      };
    }
  }

  return { ok: true };
}

export async function applyStockMovementBatch(
  orgId: string,
  entries: StockMovementDelta[]
): Promise<{ ok: true; count: number }> {
  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    quantity: Number(entry.quantity),
  }));

  if (normalizedEntries.length === 0) {
    return { ok: true, count: 0 };
  }

  const productRepo = await import("@/repositories/productRepo");
  const currentLevels = await productRepo.getAllStockLevels(orgId);
  const validation = validateStockMovementPlan(normalizedEntries, currentLevels);
  if (!validation.ok) {
    throw new Error(validation.reason ?? "Stock movement validation failed.");
  }

  const supabase = await createClient();
  const rpc = (supabase as typeof supabase & { rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc;

  if (typeof rpc === "function") {
    const { data, error } = await rpc.call(supabase, "apply_stock_movement_batch", {
      p_org_id: orgId,
      p_entries: normalizedEntries,
    });
    if (error) {
      throw error;
    }
    return { ok: true, count: Array.isArray(data) ? data.length : normalizedEntries.length };
  }

  for (const entry of normalizedEntries) {
    if (entry.from_location_type && entry.from_location_id) {
      await productRepo.upsertStockLevel(
        orgId,
        entry.product_id,
        entry.from_location_type,
        entry.from_location_id,
        -entry.quantity
      );
    }

    if (entry.to_location_type && entry.to_location_id) {
      await productRepo.upsertStockLevel(
        orgId,
        entry.product_id,
        entry.to_location_type,
        entry.to_location_id,
        entry.quantity
      );
    }
  }

  return { ok: true, count: normalizedEntries.length };
}
