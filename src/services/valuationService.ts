import { createClient } from "@/lib/supabase/server";
import type { PriceHistory } from "@/types";

export async function getValuationHistory(orgId: string, productId: string): Promise<PriceHistory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("org_id", orgId)
    .eq("product_id", productId)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getValuationTrend(orgId: string, productId: string): Promise<"up" | "down" | "stable"> {
  const history = await getValuationHistory(orgId, productId);
  if (history.length < 2) return "stable";
  const latest = history[0].cost_mmk;
  const previous = history[1].cost_mmk;
  if (latest > previous) return "up";
  if (latest < previous) return "down";
  return "stable";
}

export async function recordPrice(
  orgId: string,
  productId: string,
  costMmk: number,
  usdRate: number,
  source: "PO" | "MANUAL" = "PO"
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("price_history").insert({
    org_id: orgId,
    product_id: productId,
    cost_mmk: costMmk,
    usd_rate: usdRate,
    source,
  });
  if (error) throw error;
}
