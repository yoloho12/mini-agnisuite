"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, PenLine, Printer, Truck } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import {
  fetchDispatch,
  fetchDispatchLineItems,
  acknowledgeDispatch,
} from "@/app/actions/dispatchActions";
import { fetchCurrentUser } from "@/app/actions/settingsActions";
import { fetchProducts } from "@/app/actions/productActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { friendlyErrorMessage } from "@/lib/errors";
import { canAcknowledgeDispatch } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth";
import type { Dispatch, DispatchLineItem, Product, Warehouse, Site } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "info"> = {
  DRAFT: "default",
  DISPATCHED: "info",
  ACKNOWLEDGED: "success",
};

export default function DispatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [lineItems, setLineItems] = useState<DispatchLineItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [d, li, p, whs, sts, me] = await Promise.all([
        fetchDispatch(id as string),
        fetchDispatchLineItems(id as string),
        fetchProducts(),
        fetchWarehouses().catch(() => [] as Warehouse[]),
        fetchSites().catch(() => [] as Site[]),
        fetchCurrentUser().catch(() => null),
      ]);
      setDispatch(d);
      setLineItems(li);
      setProducts(p);
      setWarehouses(whs);
      setSites(sts);
      setUser(me);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  async function handleAcknowledge() {
    setAcknowledging(true);
    try {
      const res = await acknowledgeDispatch(id);
      if (res.ok) {
        toast.success("Receipt signed", {
          description: "The dispatch has been acknowledged at the receiving end.",
        });
        await load();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Could not acknowledge the dispatch."));
    } finally {
      setAcknowledging(false);
    }
  }

  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted mb-4">Failed to load dispatch.</p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  if (!dispatch) return <div className="text-center py-12 text-muted">Dispatch not found</div>;

  const productName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.name : productId;
  };

  const warehouseName = (whId: string) =>
    warehouses.find((w) => w.id === whId)?.name ?? whId;
  const siteName = (sId: string) => sites.find((s) => s.id === sId)?.name ?? sId;

  const isReceiver = !!user?.site_id && user.site_id === dispatch.to_site_id;
  const canSign =
    canAcknowledgeDispatch(user?.role) &&
    (user?.role === "owner" || user?.role === "manager" || isReceiver);
  const isAcknowledged = dispatch.status === "ACKNOWLEDGED";

  const lineColumns = [
    { key: "product_id", header: "Product", render: (li: DispatchLineItem) => productName(li.product_id) },
    { key: "quantity", header: "Quantity" },
  ];

  return (
    <div>
      <PageHeader
        title={dispatch.dispatch_number}
        description={isReceiver ? "Incoming to your site" : "Dispatch details"}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/dispatches")}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button onClick={() => router.push(`/dispatches/${id}/note`)}>
              <Printer size={16} /> Print Note
            </Button>
          </div>
        }
      />

      {isReceiver && canSign && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          You are signed in as the receiver for{" "}
          <span className="font-medium">{siteName(dispatch.to_site_id)}</span>. Review the items below and sign to confirm receipt.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Dispatch Info</CardTitle>
          <CardContent className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Status</span>
              <Badge variant={statusVariant[dispatch.status] || "default"}>{dispatch.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">From Warehouse</span>
              <span className="text-sm font-medium">{warehouseName(dispatch.from_warehouse_id)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">To Site</span>
              <span className="text-sm font-medium">{siteName(dispatch.to_site_id)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Sender</span>
              <span className="text-sm font-medium">{dispatch.sender_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Receiver</span>
              <span className="text-sm font-medium">{dispatch.receiver_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Dispatched At</span>
              <span className="text-sm font-medium">{dispatch.dispatched_at ? formatDate(dispatch.dispatched_at) : "-"}</span>
            </div>
            {dispatch.dispatch_note && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted">Note</p>
                <p className="text-sm mt-1">{dispatch.dispatch_note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Line Items</CardTitle>
          <CardContent className="mt-4">
            {lineItems.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="No line items"
                description="This dispatch has no items."
              />
            ) : (
              <Table columns={lineColumns} data={lineItems} emptyMessage="No items" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Receiving</CardTitle>
        <CardContent className="mt-4 space-y-3">
          {isAcknowledged ? (
            <>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Received by</span>
                <span className="text-sm font-medium">{dispatch.receiver_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Received at</span>
                <span className="text-sm font-medium">
                  {dispatch.acknowledged_at ? formatDateTime(dispatch.acknowledged_at) : "-"}
                </span>
              </div>
            </>
          ) : canSign ? (
            <>
              <p className="text-sm text-muted">
                {isReceiver
                  ? "Confirm that you have received these items. Your saved digital signature will be applied."
                  : "Acting on behalf of the receiving site — your saved digital signature will be applied."}
              </p>
              {user?.signature ? (
                <div className="rounded-lg border border-border bg-background p-3">
                  <img src={user.signature} alt="Your signature" className="h-14 object-contain" />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
                  No signature on file.{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/settings")}
                    className="text-primary underline"
                  >
                    Add your signature in Settings
                  </button>
                  .
                </div>
              )}
              <Button onClick={handleAcknowledge} loading={acknowledging} disabled={!user?.signature}>
                <PenLine size={16} /> {isReceiver ? "Receive & Sign" : "Sign on behalf"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">
              Awaiting receipt confirmation from {siteName(dispatch.to_site_id)}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
