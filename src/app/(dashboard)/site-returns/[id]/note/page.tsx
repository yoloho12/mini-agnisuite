"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { fetchSiteReturn, fetchSiteReturnLineItems } from "@/app/actions/siteReturnActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchProducts } from "@/app/actions/productActions";
import { formatDate } from "@/lib/utils";
import type { SiteReturn, SiteReturnLineItem, Site, Warehouse, Product } from "@/types";

const reasonLabel: Record<string, string> = {
  UNUSED: "Unused",
  DEFECTIVE: "Defective",
  WRONG_ITEM: "Wrong Item",
  PROJECT_COMPLETED: "Project Completed",
  OTHER: "Other",
};

export default function ReturnNotePage() {
  const params = useParams();
  const [siteReturn, setSiteReturn] = useState<SiteReturn | null>(null);
  const [lineItems, setLineItems] = useState<SiteReturnLineItem[]>([]);
  const [fromSite, setFromSite] = useState<Site | null>(null);
  const [toWarehouse, setToWarehouse] = useState<Warehouse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoadError(null);
      setLoading(true);
      const id = params.id as string;
      const [sr, li, sites, warehouses, prods] = await Promise.all([
        fetchSiteReturn(id),
        fetchSiteReturnLineItems(id),
        fetchSites(),
        fetchWarehouses(),
        fetchProducts(),
      ]);
      setSiteReturn(sr);
      setLineItems(li);
      setProducts(prods);
      if (sr) {
        setFromSite(sites.find((s) => s.id === sr.from_site_id) || null);
        setToWarehouse(warehouses.find((w) => w.id === sr.to_warehouse_id) || null);
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
        <PageHeader title="Return Note" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Return Note" />
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted">{loadError}</p>
          <Button onClick={loadData}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!siteReturn) {
    return (
      <div>
        <PageHeader title="Return Note" />
        <EmptyState
          icon={Printer}
          title="Return not found"
          description="The site return could not be found."
        />
      </div>
    );
  }

  const totalQty = lineItems.reduce((sum, li) => sum + li.quantity, 0);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Return Note"
          actions={
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
          }
        />
      </div>

      <div className="print-doc max-w-3xl mx-auto bg-white text-black p-8 border border-gray-300">
        <div className="text-center mb-6 border-b border-gray-300 pb-4">
          <h1 className="text-xl font-bold text-black">RETURN NOTE</h1>
          <p className="text-sm text-gray-600 mt-1">{siteReturn.return_number}</p>
          <p className="text-sm text-gray-600">Date: {formatDate(siteReturn.created_at)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">From</p>
            <p className="font-medium text-black">{fromSite?.name || siteReturn.from_site_id}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">To</p>
            <p className="font-medium text-black">{toWarehouse?.name || siteReturn.to_warehouse_id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Sender</p>
            <p className="font-medium text-black">{siteReturn.sender_name}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Signature</p>
            <p className="text-black">____________________</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6 border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 text-black font-semibold">Product</th>
              <th className="text-right py-2 text-black font-semibold">Quantity</th>
              <th className="text-left py-2 text-black font-semibold">Reason</th>
              <th className="text-left py-2 text-black font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-200">
                <td className="py-2 text-black">{productName(li.product_id)}</td>
                <td className="py-2 text-black text-right">{li.quantity}</td>
                <td className="py-2 text-black">{reasonLabel[li.reason] || li.reason}</td>
                <td className="py-2 text-black text-xs">{li.condition_notes || ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400">
              <td className="py-2 text-right font-bold text-black">Total</td>
              <td className="py-2 text-right font-bold text-black">{totalQty}</td>
              <td colSpan={2}></td>
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
