"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { fetchDispatch, fetchDispatchLineItems } from "@/app/actions/dispatchActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchProducts } from "@/app/actions/productActions";
import { formatDate } from "@/lib/utils";
import type { Dispatch, DispatchLineItem, Warehouse, Site, Product } from "@/types";

export default function DispatchNotePage() {
  const params = useParams();
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [lineItems, setLineItems] = useState<DispatchLineItem[]>([]);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoadError(null);
      setLoading(true);
      const id = params.id as string;
      const [d, li, warehouses, sites, prods] = await Promise.all([
        fetchDispatch(id),
        fetchDispatchLineItems(id),
        fetchWarehouses(),
        fetchSites(),
        fetchProducts(),
      ]);
      setDispatch(d);
      setLineItems(li);
      setProducts(prods);
      if (d) {
        setWarehouse(warehouses.find((w) => w.id === d.from_warehouse_id) || null);
        setSite(sites.find((s) => s.id === d.to_site_id) || null);
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
        <PageHeader title="Dispatch Note" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Dispatch Note" />
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted">{loadError}</p>
          <Button onClick={loadData}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!dispatch) {
    return (
      <div>
        <PageHeader title="Dispatch Note" />
        <EmptyState
          icon={Printer}
          title="Dispatch not found"
          description="The dispatch could not be found."
        />
      </div>
    );
  }

  const totalQty = lineItems.reduce((sum, li) => sum + li.quantity, 0);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Dispatch Note"
          actions={
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
          }
        />
      </div>

      <div className="print-doc max-w-2xl mx-auto bg-white text-black p-8 border border-gray-300">
        <div className="text-center mb-6 border-b border-gray-300 pb-4">
          <h1 className="text-xl font-bold text-black">DISPATCH NOTE</h1>
          <p className="text-sm text-gray-600 mt-1">{dispatch.dispatch_number}</p>
          <p className="text-sm text-gray-600">Date: {formatDate(dispatch.dispatched_at)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">From</p>
            <p className="font-medium text-black">{warehouse?.name || dispatch.from_warehouse_id}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">To</p>
            <p className="font-medium text-black">{site?.name || dispatch.to_site_id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Sender</p>
            <p className="font-medium text-black">{dispatch.sender_name}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Receiver</p>
            <p className="font-medium text-black">{dispatch.receiver_name}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Signature</p>
            {dispatch.receiver_signature ? (
              dispatch.receiver_signature.startsWith("data:image") ? (
                <img
                  src={dispatch.receiver_signature}
                  alt="Receiver signature"
                  className="h-12 object-contain"
                />
              ) : (
                <p className="font-medium text-black">{dispatch.receiver_signature}</p>
              )
            ) : (
              <p className="text-black">____________________</p>
            )}
          </div>
        </div>

        <table className="w-full text-sm mb-6 border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 text-black font-semibold">Product</th>
              <th className="text-right py-2 text-black font-semibold">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-200">
                <td className="py-2 text-black">{productName(li.product_id)}</td>
                <td className="py-2 text-black text-right">{li.quantity}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400">
              <td className="py-2 text-right font-bold text-black">Total</td>
              <td className="py-2 text-right font-bold text-black">{totalQty}</td>
            </tr>
          </tfoot>
        </table>

        <div className="text-center text-xs text-gray-400 border-t border-gray-300 pt-4">
          Generated by Mini-AgniSuite
        </div>
      </div>
    </div>
  );
}
