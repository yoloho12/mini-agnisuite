import { createClient } from "@/lib/supabase/server";
import type { PriceHistory, Product, StockLevel } from "@/types";

export async function getProducts(orgId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProduct(product: Omit<Product, "id" | "created_at" | "updated_at">): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createProducts(
  products: Omit<Product, "id" | "created_at" | "updated_at">[]
): Promise<Product[]> {
  if (products.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(products)
    .select();
  if (error) throw error;
  return data || [];
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/** All non-empty barcode values in an org, used to keep generated codes unique. */
export async function getBarcodeValues(orgId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("barcode_value")
    .eq("org_id", orgId);
  if (error) throw error;
  return (data || [])
    .map((row) => (row as Pick<Product, "barcode_value">).barcode_value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

export async function getProductByBarcode(orgId: string, barcode: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("org_id", orgId)
    .or(`barcode_value.eq.${barcode},sku.eq.${barcode}`)
    .single();
  if (error) return null;
  return data;
}

export async function getStockLevels(orgId: string, productId: string): Promise<StockLevel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_levels")
    .select("*")
    .eq("org_id", orgId)
    .eq("product_id", productId);
  if (error) throw error;
  return data || [];
}

export async function getAllStockLevels(orgId: string): Promise<StockLevel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_levels")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw error;
  return data || [];
}

export async function upsertStockLevel(
  orgId: string,
  productId: string,
  locationType: string,
  locationId: string,
  quantityDelta: number
): Promise<StockLevel> {
  const supabase = await createClient();
  const existing = await supabase
    .from("stock_levels")
    .select("*")
    .eq("org_id", orgId)
    .eq("product_id", productId)
    .eq("location_type", locationType)
    .eq("location_id", locationId)
    .single();

  if (existing.data) {
    const newQty = existing.data.quantity + quantityDelta;
    const status = newQty <= 0 ? "OUT_OF_STOCK" : newQty <= (existing.data.reserved_quantity || 0) ? "LOW_STOCK" : "IN_STOCK";
    const { data, error } = await supabase
      .from("stock_levels")
      .update({ quantity: newQty, status })
      .eq("id", existing.data.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const status = quantityDelta <= 0 ? "OUT_OF_STOCK" : "IN_STOCK";
    const { data, error } = await supabase
      .from("stock_levels")
      .insert({
        org_id: orgId,
        product_id: productId,
        location_type: locationType,
        location_id: locationId,
        quantity: quantityDelta,
        status,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function recordPriceHistory(
  orgId: string,
  productId: string,
  costMmk: number,
  usdRate: number,
  source: "PO" | "MANUAL"
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("price_history").insert({
    org_id: orgId,
    product_id: productId,
    cost_mmk: costMmk,
    usd_rate: usdRate,
    source,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getPriceHistory(orgId: string, productId: string): Promise<PriceHistory[]> {
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
