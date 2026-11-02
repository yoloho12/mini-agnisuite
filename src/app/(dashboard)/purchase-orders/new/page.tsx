"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import PriceInput from "@/components/ui/PriceInput";
import Select from "@/components/ui/Select";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { addPurchaseOrder } from "@/app/actions/poActions";
import { formatMmk } from "@/lib/money";
import { fetchContacts } from "@/app/actions/contactActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchProducts, fetchProductStock } from "@/app/actions/productActions";
import { getProductIdParam, bestLocation } from "@/lib/quick-prefill";
import type { Contact, Warehouse, Site, Product, LocationType } from "@/types";

interface LineItem {
  product_id: string;
  qty_ordered: number;
  unit_cost: number;
  /** "warehouse" (follows the PO's destination warehouse) or "site:<id>" for direct-to-site allocation. */
  dest: string;
}

export default function NewPOPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [currency, setCurrency] = useState<"MMK" | "USD">("MMK");
  const [usdRate, setUsdRate] = useState(2100);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { product_id: "", qty_ordered: 1, unit_cost: 0, dest: "warehouse" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      setLoadError(null);
      const [s, w, st, p] = await Promise.all([
        fetchContacts(undefined, "SUPPLIER"),
        fetchWarehouses(),
        fetchSites(),
        fetchProducts(),
      ]);
      setSuppliers(s);
      setWarehouses(w);
      setSites(st);
      setProducts(p);
      setDataLoaded(true);
      await prefillFromProductParam(p, w);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  /** Quick Actions launch here with ?product=<id> — prefill the line and destination. */
  async function prefillFromProductParam(allProducts: Product[], allWarehouses: Warehouse[]) {
    const paramId = getProductIdParam();
    const product = paramId ? allProducts.find((x) => x.id === paramId) : undefined;
    if (!product) return;
    setLineItems([
      {
        product_id: product.id,
        qty_ordered: 1,
        unit_cost: product.last_purchase_cost_mmk || product.base_cost_mmk,
        dest: "warehouse",
      },
    ]);
    try {
      const stockRows = await fetchProductStock(product.id);
      const dest = bestLocation(stockRows, "WAREHOUSE");
      if (dest && allWarehouses.some((wh) => wh.id === dest.location_id)) {
        setWarehouseId(dest.location_id);
      } else if (allWarehouses.length > 0) {
        setWarehouseId(allWarehouses[0].id);
      }
    } catch {
      // Stock lookup is best-effort — the product line is already prefilled.
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function addLineItem() {
    setLineItems([...lineItems, { product_id: "", qty_ordered: 1, unit_cost: 0, dest: "warehouse" }]);
  }

  function removeLineItem(i: number) {
    setLineItems(lineItems.filter((_, idx) => idx !== i));
  }

  function updateLineItem(i: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], [field]: value };
    setLineItems(updated);
  }

  function toMmk(cost: number): number {
    if (currency === "USD") return Math.round(cost * usdRate);
    return cost;
  }

  /** Product's last purchase cost converted to the order currency — shown as a hint while typing. */
  function lastCostFor(productId: string): number | null {
    const p = products.find((x) => x.id === productId);
    if (!p) return null;
    const mmk = p.last_purchase_cost_mmk || p.base_cost_mmk;
    if (!mmk) return null;
    return currency === "USD" ? Math.round(mmk / (usdRate || 1)) : mmk;
  }

  const totalMmk = lineItems.reduce(
    (sum, li) => sum + li.qty_ordered * toMmk(li.unit_cost),
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !warehouseId) return;
    if (lineItems.length === 0 || lineItems.every((li) => !li.product_id)) return;

    setSubmitting(true);
    try {
      const validItems = lineItems
        .filter((li) => li.product_id)
        .map((li) => {
          const isSite = li.dest.startsWith("site:");
          return {
            product_id: li.product_id,
            qty_ordered: li.qty_ordered,
            unit_cost_mmk: toMmk(li.unit_cost),
            dest_type: (isSite ? "SITE" : "WAREHOUSE") as LocationType,
            dest_id: isSite ? li.dest.slice(5) : null,
          };
        });

      await addPurchaseOrder(
{
          org_id: "",
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          status: "PENDING",
          currency,
          usd_rate: currency === "USD" ? usdRate : 0,
          total_mmk: totalMmk,
          notes: notes || null,
          created_by: "",
        },
        validItems
      );
      toast.success("PO created", { description: "Purchase order has been created successfully." });
      router.push("/purchase-orders");
    } catch (err: unknown) {
      toast.error("Failed to create PO", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!dataLoaded && !loadError) {
    return (
      <div>
        <PageHeader title="New Purchase Order" description="Receive goods from a supplier into a warehouse" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="New Purchase Order" description="Receive goods from a supplier into a warehouse" />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted">{loadError}</p>
            <Button onClick={loadData}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Purchase Order"
        description="Receive goods from a supplier — allocate lines to a warehouse or directly to a site"
        actions={
          <Button variant="secondary" onClick={() => router.push("/purchase-orders")}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardTitle>Order Details</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select supplier"
              />
              <Select
                label="Destination Warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                placeholder="Select warehouse"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "MMK" | "USD")}
                options={[
                  { value: "MMK", label: "MMK" },
                  { value: "USD", label: "USD" },
                ]}
                wrapperClassName={currency === "MMK" ? "col-span-2" : undefined}
              />
              {currency === "USD" && (
                <PriceInput
                  label="USD Rate"
                  value={usdRate}
                  onChange={(v) => setUsdRate(v)}
                />
              )}
            </div>
            <Input
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={addLineItem}>
              <Plus size={14} /> Add Item
            </Button>
          </div>
          <CardContent className="mt-4 space-y-3">
            {lineItems.map((li, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Select
                    label={i === 0 ? "Product" : ""}
                    value={li.product_id}
                    onChange={(e) => updateLineItem(i, "product_id", e.target.value)}
                    options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})${p.category ? ` — ${p.category}` : ""}` }))}
                    placeholder="Select product"
                  />
                </div>
                <div className="w-24">
                  <NumericInput
                    label={i === 0 ? "Qty" : ""}
                    value={li.qty_ordered}
                    onChange={(v) => updateLineItem(i, "qty_ordered", v)}
                    min={1}
                  />
                </div>
                <div className="w-32">
                  <PriceInput
                    label={i === 0 ? `Unit Cost (${currency})` : ""}
                    value={li.unit_cost}
                    onChange={(v) => updateLineItem(i, "unit_cost", v)}
                    previousValue={lastCostFor(li.product_id)}
                    currency={currency}
                  />
                </div>
                <div className="w-48">
                  <Select
                    label={i === 0 ? "Deliver To" : ""}
                    value={li.dest}
                    onChange={(e) => updateLineItem(i, "dest", e.target.value)}
                    options={[
                      { value: "warehouse", label: `Warehouse — ${warehouses.find((w) => w.id === warehouseId)?.name || "select warehouse"}` },
                      ...sites.map((s) => ({ value: `site:${s.id}`, label: `Site — ${s.name}` })),
                    ]}
                  />
                </div>
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(i)}
                    className="p-2 text-muted hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-3 border-t border-border">
              <span className="text-lg font-semibold">
                Total: {formatMmk(totalMmk)}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/purchase-orders")}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Purchase Order
          </Button>
        </div>
      </form>
    </div>
  );
}
