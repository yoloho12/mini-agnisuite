"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import PriceInput from "@/components/ui/PriceInput";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import Table from "@/components/ui/Table";
import {
  fetchPurchaseOrder,
  fetchPOLineItems,
  fetchPOReceipts,
  receivePOItems,
} from "@/app/actions/poActions";
import { fetchProducts } from "@/app/actions/productActions";
import { fetchContacts } from "@/app/actions/contactActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchCurrentUser } from "@/app/actions/settingsActions";
import { canReceivePurchaseOrder } from "@/lib/permissions";
import { formatMmk } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth";
import type { PurchaseOrder, POLineItem, POReceipt, Product, Contact, Warehouse, Site } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  PENDING: "warning",
  PARTIAL: "info",
  RECEIVED: "success",
  CANCELLED: "danger",
};

interface ReceiveLine {
  line_item_id: string;
  product_id: string;
  qty: number;
  unit_cost_mmk: number;
}

export default function PODetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [receipts, setReceipts] = useState<POReceipt[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplier, setSupplier] = useState<Contact | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [receiveItems, setReceiveItems] = useState<ReceiveLine[]>([]);
  const [receivedBy, setReceivedBy] = useState("");
  const [receiving, setReceiving] = useState(false);

  async function loadData() {
    try {
      setLoadError(null);
      const [p, li, r, prods, contacts, whs, sts, me] = await Promise.all([
        fetchPurchaseOrder(poId),
        fetchPOLineItems(poId),
        fetchPOReceipts(poId),
        fetchProducts(),
        fetchContacts(undefined, "SUPPLIER"),
        fetchWarehouses(),
        fetchSites(),
        fetchCurrentUser().catch(() => null),
      ]);
      setPo(p);
      setLineItems(li);
      setReceipts(r);
      setProducts(prods);
      setWarehouses(whs);
      setSites(sts);
      setUser(me);
      setReceivedBy((prev) => prev || me?.full_name || "");
      if (p) {
        const found = contacts.find((c) => c.id === p.supplier_id);
        setSupplier(found || null);
      }
      setDataLoaded(true);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  useEffect(() => {
    if (poId) loadData();
  }, [poId]);

  function productName(productId: string): string {
    return products.find((p) => p.id === productId)?.name || productId;
  }

  function destLabel(li: POLineItem): string {
    if (li.dest_type === "SITE" && li.dest_id) {
      const site = sites.find((s) => s.id === li.dest_id);
      return site ? `Site — ${site.name}` : "Site";
    }
    if (li.dest_id) {
      const wh = warehouses.find((w) => w.id === li.dest_id);
      return wh ? `Warehouse — ${wh.name}` : "Warehouse";
    }
    const poWh = po ? warehouses.find((w) => w.id === po.warehouse_id) : null;
    return poWh ? `Warehouse — ${poWh.name}` : "PO warehouse";
  }

  function remainingToReceive(line: POLineItem, ignoreReceiveIndex?: number): number {
    const alreadyEntered = receiveItems
      .filter((item, index) => index !== ignoreReceiveIndex && item.line_item_id === line.id)
      .reduce((sum, item) => sum + item.qty, 0);
    return Math.max(0, line.qty_ordered - line.qty_received - alreadyEntered);
  }

  function productOptionsWithDest(ignoreReceiveIndex?: number): { value: string; label: string }[] {
    const siteId = user?.site_id ?? null;
    const opts: { value: string; label: string }[] = [];
    for (const li of lineItems) {
      const remaining = remainingToReceive(li, ignoreReceiveIndex);
      if (remaining <= 0) continue;
      // A site user only receives lines allocated directly to their own site.
      if (siteId && !(li.dest_type === "SITE" && li.dest_id === siteId)) continue;
      opts.push({ value: li.id, label: `${productName(li.product_id)} → ${destLabel(li)} (${remaining} remaining)` });
    }
    return opts;
  }

  function addReceiveLine() {
    const firstUnreceived = lineItems.find((li) => remainingToReceive(li) > 0);
    if (!firstUnreceived) return;
    setReceiveItems([
      ...receiveItems,
      {
        line_item_id: firstUnreceived.id,
        product_id: firstUnreceived.product_id,
        qty: remainingToReceive(firstUnreceived),
        unit_cost_mmk: firstUnreceived.unit_cost_mmk,
      },
    ]);
  }

  function removeReceiveLine(i: number) {
    setReceiveItems(receiveItems.filter((_, idx) => idx !== i));
  }

  function updateReceiveLine(i: number, field: keyof ReceiveLine, value: string | number) {
    const updated = [...receiveItems];
    if (field === "line_item_id") {
      const line = lineItems.find((item) => item.id === value);
      if (!line) return;
      updated[i] = {
        ...updated[i],
        line_item_id: line.id,
        product_id: line.product_id,
        qty: Math.min(updated[i].qty, remainingToReceive(line, i)),
        unit_cost_mmk: line.unit_cost_mmk,
      };
    } else {
      updated[i] = { ...updated[i], [field]: value };
    }
    setReceiveItems(updated);
  }

  async function handleReceive() {
    if (receiveItems.length === 0 || !receivedBy.trim()) return;
    setReceiving(true);
    try {
      await receivePOItems(
        poId,
        receiveItems.filter((ri) => ri.qty > 0),
        receivedBy.trim(),
        supplier?.name || "Supplier",
        user?.signature ?? null
      );
      toast.success("Items received", { description: "Stock has been updated." });
      setReceiveItems([]);
      setDataLoaded(false);
      await loadData();
    } catch (err: unknown) {
      toast.error("Failed to receive items", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setReceiving(false);
    }
  }

  if (!dataLoaded && !loadError) {
    return (
      <div>
        <PageHeader title="Purchase Order" description="Purchase Order detail" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Purchase Order" description="Purchase Order detail" />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted">{loadError}</p>
            <Button onClick={loadData}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!po) {
    return (
      <div>
        <PageHeader title="Purchase Order" description="Purchase Order detail" />
        <div className="text-center py-12 text-muted">PO not found</div>
      </div>
    );
  }

  const canReceiveMore = po.status === "PENDING" || po.status === "PARTIAL";
  const canReceive = canReceivePurchaseOrder(user?.role) && canReceiveMore;
  const isSiteUser = user?.role === "staff_site";

  const lineColumns = [
    {
      key: "name",
      header: "Product",
      render: (li: POLineItem) => productName(li.product_id),
    },
    {
      key: "dest",
      header: "Deliver To",
      render: (li: POLineItem) => destLabel(li),
    },
    { key: "qty_ordered", header: "Qty Ordered" },
    { key: "qty_received", header: "Qty Received" },
    {
      key: "unit_cost_mmk",
      header: "Unit Cost",
      render: (li: POLineItem) => formatMmk(li.unit_cost_mmk),
    },
    {
      key: "status",
      header: "Status",
      render: (li: POLineItem) => (
        <Badge variant={statusVariant[li.status] || "default"}>{li.status}</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={po.po_number}
        description="Purchase Order detail"
        actions={
          <Button variant="secondary" onClick={() => router.push("/purchase-orders")}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardTitle>Order Details</CardTitle>
          <CardContent className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Status</span>
              <Badge variant={statusVariant[po.status]}>{po.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Supplier</span>
              <span className="text-sm font-medium">{supplier?.name || po.supplier_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Warehouse</span>
              <span className="text-sm font-medium">
                {warehouses.find((w) => w.id === po.warehouse_id)?.name || po.warehouse_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Currency</span>
              <span className="text-sm font-medium">{po.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Total</span>
              <span className="text-sm font-semibold">{formatMmk(po.total_mmk)}</span>
            </div>
            {po.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted">Notes</p>
                <p className="text-sm mt-1">{po.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Receipts</CardTitle>
          <CardContent className="mt-4">
            {receipts.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">No receipts yet</p>
            ) : (
              <div className="space-y-3">
                {receipts.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.slip_number}</p>
                      <p className="text-xs text-muted">
                        Received by {r.received_by}
                      </p>
                      {r.receiver_signature?.startsWith("data:image") && (
                        <img
                          src={r.receiver_signature}
                          alt="Signature"
                          className="mt-1 h-8 object-contain"
                        />
                      )}
                    </div>
                    <span className="text-xs text-muted">{formatDateTime(r.received_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardTitle>Line Items</CardTitle>
        <CardContent className="mt-4">
          <Table columns={lineColumns} data={lineItems} emptyMessage="No line items" />
        </CardContent>
      </Card>

      {canReceive && productOptionsWithDest().length > 0 && (
        <Card className="mb-6">
          <CardTitle>Receive Items</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <Input
              label="Received By"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Enter name"
              readOnly={isSiteUser}
            />
            {isSiteUser && (
              <p className="-mt-2 text-xs text-muted">
                Receiving on behalf of your site — your signature will be applied.
              </p>
            )}

            {user?.signature ? (
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted mb-1">Signature applied to this receipt</p>
                <img src={user.signature} alt="Your signature" className="h-12 object-contain" />
              </div>
            ) : (
              isSiteUser && (
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
              )
            )}

            {receiveItems.map((ri, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Select
                    label={i === 0 ? "Product" : ""}
                    value={ri.line_item_id}
                    onChange={(e) => updateReceiveLine(i, "line_item_id", e.target.value)}
                    options={productOptionsWithDest(i)}
                    placeholder="Select product"
                  />
                </div>
                <div className="w-28">
                  <NumericInput
                    label={i === 0 ? "Quantity" : ""}
                    value={ri.qty}
                    onChange={(v) => updateReceiveLine(i, "qty", v)}
                    min={1}
                  />
                </div>
                <div className="w-36">
                  <PriceInput
                    label={i === 0 ? "Unit Cost (MMK)" : ""}
                    value={ri.unit_cost_mmk}
                    onChange={(v) => updateReceiveLine(i, "unit_cost_mmk", v)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeReceiveLine(i)}
                  className="p-2 text-muted hover:text-danger"
                >
                  <ArrowLeft size={16} className="rotate-45" />
                </button>
              </div>
            ))}

            <div className="flex justify-between items-center pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={addReceiveLine}>
                Add Received Item
              </Button>
              <Button
                type="button"
                loading={receiving}
                disabled={receiveItems.length === 0 || !receivedBy.trim()}
                onClick={handleReceive}
              >
                Receive Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
