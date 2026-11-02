"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, RotateCcw } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { fetchSiteReturn, fetchSiteReturnLineItems } from "@/app/actions/siteReturnActions";
import { fetchProducts } from "@/app/actions/productActions";
import { formatDate } from "@/lib/utils";
import type { SiteReturn, SiteReturnLineItem, Product } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "info"> = {
  DRAFT: "default",
  RETURNED: "info",
  ACKNOWLEDGED: "success",
};

const reasonLabel: Record<string, string> = {
  UNUSED: "Unused / Excess",
  DEFECTIVE: "Defective / Damaged",
  WRONG_ITEM: "Wrong Item Sent",
  PROJECT_COMPLETED: "Project Completed",
  OTHER: "Other",
};

const reasonVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  UNUSED: "default",
  DEFECTIVE: "danger",
  WRONG_ITEM: "warning",
  PROJECT_COMPLETED: "success",
  OTHER: "info",
};

export default function SiteReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [siteReturn, setSiteReturn] = useState<SiteReturn | null>(null);
  const [lineItems, setLineItems] = useState<SiteReturnLineItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [r, li, p] = await Promise.all([
        fetchSiteReturn(id),
        fetchSiteReturnLineItems(id),
        fetchProducts(),
      ]);
      setSiteReturn(r);
      setLineItems(li);
      setProducts(p);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  if (loading) return <Spinner />;

  if (loadError) {
    return (
      <div>
        <PageHeader
          title="Site Return"
          actions={
            <Button variant="secondary" onClick={() => router.push("/site-returns")}>
              <ArrowLeft size={16} /> Back
            </Button>
          }
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load site return.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!siteReturn) return <div className="text-center py-12 text-muted">Return not found</div>;

  const productName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : productId;
  };

  const lineColumns = [
    { key: "product_id", header: "Product", render: (li: SiteReturnLineItem) => productName(li.product_id) },
    { key: "quantity", header: "Quantity" },
    {
      key: "reason",
      header: "Reason",
      render: (li: SiteReturnLineItem) => (
        <Badge variant={reasonVariant[li.reason] || "default"}>
          {reasonLabel[li.reason] || li.reason}
        </Badge>
      ),
    },
    {
      key: "condition_notes",
      header: "Notes",
      render: (li: SiteReturnLineItem) => li.condition_notes || "-",
    },
  ];

  return (
    <div>
      <PageHeader
        title={siteReturn.return_number}
        description="Site return details"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/site-returns")}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button onClick={() => router.push(`/site-returns/${id}/note`)}>
              <Printer size={16} /> Print Note
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        <Card>
          <CardTitle>Return Info</CardTitle>
          <CardContent className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Status</span>
              <Badge variant={statusVariant[siteReturn.status] || "default"}>{siteReturn.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">From Site</span>
              <span className="text-sm font-medium">{siteReturn.from_site_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">To Warehouse</span>
              <span className="text-sm font-medium">{siteReturn.to_warehouse_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Sender</span>
              <span className="text-sm font-medium">{siteReturn.sender_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Signature</span>
              <span className="text-sm font-medium">{siteReturn.sender_signature || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Date</span>
              <span className="text-sm font-medium">{formatDate(siteReturn.created_at)}</span>
            </div>
            {siteReturn.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted">Notes</p>
                <p className="text-sm mt-1">{siteReturn.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Line Items</CardTitle>
          <CardContent className="mt-4">
            {lineItems.length === 0 ? (
              <EmptyState
                icon={RotateCcw}
                title="No line items"
                description="This return has no items."
              />
            ) : (
              <Table columns={lineColumns} data={lineItems} emptyMessage="No items" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
