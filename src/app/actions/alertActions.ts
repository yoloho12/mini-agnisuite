"use server";

import { getCurrentOrgId, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccessLocation } from "@/lib/locationAccess";
import type { LocationType, StockStatus } from "@/types";

export interface StockAlert {
  product_id: string;
  product_name: string;
  sku: string;
  location_type: LocationType;
  location_id: string;
  quantity: number;
  reorder_point: number;
  status: StockStatus;
}

export async function fetchLowStockAlerts(): Promise<StockAlert[]> {
  const [orgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const supabase = await createClient();

  const { data: stockRows, error: stockError } = await supabase
    .from("stock_levels")
    .select("product_id, location_type, location_id, quantity")
    .eq("org_id", orgId);
  if (stockError) throw stockError;

  const rows = (stockRows ?? []).filter((row) =>
    canAccessLocation(user, row.location_type, row.location_id)
  );

  const productIds = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean)));
  let products: { id: string; name: string; sku: string; reorder_point: number }[] = [];
  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, reorder_point")
      .in("id", productIds);
    if (error) throw error;
    products = data ?? [];
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  const alerts: StockAlert[] = [];
  for (const row of rows) {
    const product = productMap.get(row.product_id);
    if (!product) continue;
    const quantity = Number(row.quantity || 0);
    const reorderPoint = Number(product.reorder_point || 0);
    let status: StockStatus = "IN_STOCK";
    if (quantity <= 0) {
      status = "OUT_OF_STOCK";
    } else if (quantity <= reorderPoint) {
      status = "LOW_STOCK";
    }
    if (status === "IN_STOCK") continue;
    alerts.push({
      product_id: row.product_id,
      product_name: product.name,
      sku: product.sku,
      location_type: row.location_type,
      location_id: row.location_id,
      quantity,
      reorder_point: reorderPoint,
      status,
    });
  }

  return alerts.sort((a, b) => a.product_name.localeCompare(b.product_name));
}