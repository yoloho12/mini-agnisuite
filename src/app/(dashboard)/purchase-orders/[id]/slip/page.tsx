"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { fetchPurchaseOrder, fetchPOLineItems, fetchPOReceipts } from "@/app/actions/poActions";
import { fetchContacts } from "@/app/actions/contactActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchProducts } from "@/app/actions/productActions";
import { formatMmk } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { PurchaseOrder, POLineItem, POReceipt, Contact, Warehouse, Product } from "@/types";

export default function PurchasingSlipPage() {
  const params = useParams();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [receipts, setReceipts] = useState<POReceipt[]>([]);
  const [supplier, setSupplier] = useState<Contact | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoadError(null);
      setLoading(true);
      const poId = params.id as string;
      const [p, li, r, contacts, warehouses, prods] = await Promise.all([
        fetchPurchaseOrder(poId),
        fetchPOLineItems(poId),
        fetchPOReceipts(poId),
        fetchContacts(),
        fetchWarehouses(),
        fetchProducts(),
      ]);
      setPo(p);
      setLineItems(li);
      setReceipts(r);
      setProducts(prods);
      if (p) {
        setSupplier(contacts.find((c) => c.id === p.supplier_id) || null);
        setWarehouse(warehouses.find((w) => w.id === p.warehouse_id) || null);
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) loadData();
  }, [params.id]);

  function productName(productId: string): string {
    return products.find((p) => p.id === productId)?.name || productId;
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Purchasing Slip" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Purchasing Slip" />
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted">{loadError}</p>
          <Button onClick={loadData}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div>
        <PageHeader title="Purchasing Slip" />
        <EmptyState
          icon={Printer}
          title="PO not found"
          description="The purchase order could not be found."
        />
      </div>
    );
  }

  const slipNumber = receipts.length > 0 ? receipts[0].slip_number : "PO " + po.po_number;

  const totalAmount = lineItems.reduce(
    (sum, li) => sum + li.unit_cost_mmk * li.qty_ordered,
    0
  );

  const signedReceipt = [...receipts]
    .reverse()
    .find((r) => r.receiver_signature?.startsWith("data:image"));
  const receiptName = signedReceipt
    ? signedReceipt.received_by
    : receipts.length > 0
      ? receipts[receipts.length - 1].received_by
      : null;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Purchasing Slip"
          actions={
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Print Slip
            </Button>
          }
        />
      </div>

      <div className="print-doc max-w-2xl mx-auto bg-white text-black p-8 border border-gray-300">
        <div className="text-center mb-6 border-b border-gray-300 pb-4">
          <h1 className="text-xl font-bold text-black">PURCHASING SLIP</h1>
          <p className="text-sm text-gray-600 mt-1">Slip: {slipNumber}</p>
          <p className="text-sm text-gray-600">Date: {formatDate(po.created_at)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Supplier</p>
            <p className="font-medium text-black">{supplier?.name || po.supplier_id}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Received at</p>
            <p className="font-medium text-black">{warehouse?.name || po.warehouse_id}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6 border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 text-black font-semibold">Product</th>
              <th className="text-right py-2 text-black font-semibold">Qty Ordered</th>
              <th className="text-right py-2 text-black font-semibold">Qty Received</th>
              <th className="text-right py-2 text-black font-semibold">Unit Cost (MMK)</th>
              <th className="text-right py-2 text-black font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-200">
                <td className="py-2 text-black">{productName(li.product_id)}</td>
                <td className="py-2 text-black text-right">{li.qty_ordered}</td>
                <td className="py-2 text-black text-right">{li.qty_received}</td>
                <td className="py-2 text-black text-right">{formatMmk(li.unit_cost_mmk)}</td>
                <td className="py-2 text-black text-right">{formatMmk(li.unit_cost_mmk * li.qty_ordered)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400">
              <td colSpan={4} className="py-2 text-right font-bold text-black">Total</td>
              <td className="py-2 text-right font-bold text-black">{formatMmk(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 mb-8">
          <p className="text-sm text-black">Received by: {receiptName || "____________________"}</p>
          {signedReceipt?.receiver_signature && (
            <img
              src={signedReceipt.receiver_signature}
              alt="Receiver signature"
              className="mt-2 h-12 object-contain"
            />
          )}
        </div>

        <div className="text-center text-xs text-gray-400 border-t border-gray-300 pt-4">
          Generated by Mini-AgniSuite
        </div>
      </div>
    </div>
  );
}
