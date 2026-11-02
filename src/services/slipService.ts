import { createClient } from "@/lib/supabase/server";
import { generateSlipNumber } from "@/lib/numberGen";

export async function getNextSlipNumber(orgId: string, supplierName: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("po_receipts")
    .select("supplier_slip_seq")
    .order("supplier_slip_seq", { ascending: false })
    .limit(1);
  const nextSeq = (data?.[0]?.supplier_slip_seq || 0) + 1;
  return generateSlipNumber(supplierName, nextSeq);
}

export async function getSupplierReceipts(supplierId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("po_receipts")
    .select("*, purchase_orders!inner(supplier_id)")
    .eq("purchase_orders.supplier_id", supplierId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
