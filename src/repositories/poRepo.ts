import { createClient } from "@/lib/supabase/server";
import type { PurchaseOrder, POLineItem, POReceipt, POAttachment } from "@/types";

export async function getPurchaseOrders(orgId: string): Promise<PurchaseOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPurchaseOrder(po: Omit<PurchaseOrder, "id" | "created_at" | "updated_at">): Promise<PurchaseOrder> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert(po)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPOLineItems(poId: string): Promise<POLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_line_items")
    .select("*")
    .eq("po_id", poId);
  if (error) throw error;
  return data || [];
}

export async function getPOLineItemsForOrders(poIds: string[]): Promise<POLineItem[]> {
  if (poIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_line_items")
    .select("*")
    .in("po_id", poIds);
  if (error) throw error;
  return data || [];
}

export async function createPOLineItems(items: Omit<POLineItem, "id">[]): Promise<POLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_line_items")
    .insert(items)
    .select();
  if (error) throw error;
  return data || [];
}

export async function updatePOLineItem(id: string, updates: Partial<POLineItem>): Promise<POLineItem> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_line_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPOReceipts(poId: string): Promise<POReceipt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_receipts")
    .select("*")
    .eq("po_id", poId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPOReceipt(receipt: Omit<POReceipt, "id">): Promise<POReceipt> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_receipts")
    .insert(receipt)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPOAttachments(poId: string): Promise<POAttachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_attachments")
    .select("*")
    .eq("po_id", poId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPOAttachment(attachment: Omit<POAttachment, "id">): Promise<POAttachment> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_attachments")
    .insert(attachment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePOAttachment(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("po_attachments").delete().eq("id", id);
  if (error) throw error;
}

export async function getNextSupplierSlipSeq(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_receipts")
    .select("supplier_slip_seq")
    .order("supplier_slip_seq", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.supplier_slip_seq || 0) + 1;
}

export interface SupplierPurchasedProduct {
  product_id: string;
  last_unit_cost_mmk: number;
}

export async function getSupplierPurchasedProducts(
  orgId: string,
  supplierId: string,
  warehouseId?: string
): Promise<SupplierPurchasedProduct[]> {
  const supabase = await createClient();
  let query = supabase
    .from("purchase_orders")
    .select("id, created_at")
    .eq("org_id", orgId)
    .eq("supplier_id", supplierId);
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  const { data: pos, error } = await query
    .order("created_at", { ascending: false });
  if (error) throw error;
  const poIds = (pos || []).map((po) => po.id);
  if (poIds.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("po_line_items")
    .select("po_id, product_id, unit_cost_mmk")
    .in("po_id", poIds);
  if (itemsError) throw itemsError;

  const poCreatedAt = new Map((pos || []).map((po) => [po.id, po.created_at]));
  const best = new Map<string, { cost: number; time: string }>();
  for (const item of items || []) {
    const time = poCreatedAt.get(item.po_id) ?? "";
    const cur = best.get(item.product_id);
    if (!cur || time > cur.time) {
      best.set(item.product_id, { cost: item.unit_cost_mmk ?? 0, time });
    }
  }
  return [...best.entries()].map(([product_id, v]) => ({
    product_id,
    last_unit_cost_mmk: v.cost,
  }));
}
