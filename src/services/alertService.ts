import { createClient } from "@/lib/supabase/server";
import type { Product, StockLevel } from "@/types";

export async function getLowStockAlerts(orgId: string) {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .gt("reorder_point", 0);

  if (!products) return [];

  const alerts: { product: Product; totalQty: number; reorderPoint: number; locations: StockLevel[] }[] = [];

  for (const product of products) {
    const { data: levels } = await supabase
      .from("stock_levels")
      .select("*")
      .eq("product_id", product.id);

    const totalQty = (levels || []).reduce((sum, l) => sum + Number(l.quantity), 0);
    if (totalQty <= product.reorder_point) {
      alerts.push({
        product,
        totalQty,
        reorderPoint: product.reorder_point,
        locations: levels || [],
      });
    }
  }

  return alerts;
}
