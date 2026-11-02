"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { addSiteReturn } from "@/app/actions/siteReturnActions";
import { fetchSites, fetchSiteStockLevels } from "@/app/actions/siteActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchProducts, fetchProductStock } from "@/app/actions/productActions";
import { getProductIdParam, bestLocation, qtyAt } from "@/lib/quick-prefill";
import { friendlyErrorMessage } from "@/lib/errors";
import type { Site, Warehouse, Product } from "@/types";

interface LineItem {
  product_id: string;
  quantity: number;
  reason: string;
  condition_notes: string;
}

const REASON_OPTIONS = [
  { value: "UNUSED", label: "Unused / Excess" },
  { value: "DEFECTIVE", label: "Defective / Damaged" },
  { value: "WRONG_ITEM", label: "Wrong Item Sent" },
  { value: "PROJECT_COMPLETED", label: "Project Completed" },
  { value: "OTHER", label: "Other" },
];

export default function NewSiteReturnPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fromSite, setFromSite] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [senderName, setSenderName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { product_id: "", quantity: 1, reason: "UNUSED", condition_notes: "" },
  ]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [siteStock, setSiteStock] = useState<Map<string, number>>(new Map());
  const [stockLoading, setStockLoading] = useState(false);

  function handleSiteChange(siteId: string) {
    setFromSite(siteId);
    setSiteStock(new Map());
    if (!siteId) return;
    setStockLoading(true);
    fetchSiteStockLevels(siteId)
      .then((levels) => {
        setSiteStock(new Map(levels.map((l) => [l.product_id, l.quantity])));
      })
      .catch(() => {
        setSiteStock(new Map());
        toast.error("Could not load stock for this site");
      })
      .finally(() => setStockLoading(false));
  }

  function availableFor(productId: string): number {
    return siteStock.get(productId) ?? 0;
  }

  function productOptions(): { value: string; label: string }[] {
    const opts = products
      .filter((p) => (siteStock.get(p.id) ?? 0) > 0)
      .map((p) => ({ value: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}${p.category ? ` — ${p.category}` : ""}` }));
    // Keep any product already selected on a line visible
    for (const li of lineItems) {
      if (!li.product_id) continue;
      if (opts.some((o) => o.value === li.product_id)) continue;
      const p = products.find((pp) => pp.id === li.product_id);
      if (p) opts.push({ value: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}` });
    }
    return opts;
  }

  function qtyProblem(li: LineItem): string | null {
    if (!li.product_id || !fromSite || stockLoading) return null;
    const available = availableFor(li.product_id);
    if (available <= 0) return "No stock";
    if (li.quantity > available) return `Only ${available}`;
    return null;
  }

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [s, w, p] = await Promise.all([fetchSites(), fetchWarehouses(), fetchProducts()]);
      setSites(s);
      setWarehouses(w);
      setProducts(p);
      await prefillFromProductParam(p, w);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  /** Quick Actions launch here with ?product=<id> — prefill both ends and the line. */
  async function prefillFromProductParam(allProducts: Product[], allWarehouses: Warehouse[]) {
    const paramId = getProductIdParam();
    const product = paramId ? allProducts.find((x) => x.id === paramId) : undefined;
    if (!product) return;
    try {
      const stockRows = await fetchProductStock(product.id);
      const from = bestLocation(stockRows, "SITE");
      const to = bestLocation(stockRows, "WAREHOUSE");
      if (from && from.quantity > 0) {
        // Loads the site stock map so the availability chip and product filter work.
        handleSiteChange(from.location_id);
        setLineItems([
          { product_id: product.id, quantity: qtyAt(stockRows, "SITE", from.location_id), reason: "UNUSED", condition_notes: "" },
        ]);
      }
      if (to && allWarehouses.some((wh) => wh.id === to.location_id)) setToWarehouse(to.location_id);
    } catch {
      // Stock lookup is best-effort — leave the form blank rather than half-filled.
    }
  }

  useEffect(() => {
    load();
  }, []);

  function addLine() {
    setLineItems([...lineItems, { product_id: "", quantity: 1, reason: "UNUSED", condition_notes: "" }]);
  }

  function removeLine(i: number) {
    setLineItems(lineItems.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], [field]: value };
    setLineItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromSite || !toWarehouse || !senderName.trim()) {
      toast.error("Pick a returning site, a destination warehouse, and a sender name");
      return;
    }
    const items = lineItems
      .filter((li) => li.product_id)
      .map((li) => ({
        product_id: li.product_id,
        quantity: li.quantity,
        reason: li.reason as "UNUSED" | "DEFECTIVE" | "WRONG_ITEM" | "PROJECT_COMPLETED" | "OTHER",
        condition_notes: li.condition_notes || null,
      }));
    if (items.length === 0) {
      toast.error("Add at least one product to return");
      return;
    }
    const problems = items
      .map((li) => {
        const line = lineItems.find((l) => l.product_id === li.product_id);
        const problem = line ? qtyProblem(line) : null;
        if (problem) {
          const name = products.find((p) => p.id === li.product_id)?.name || li.product_id;
          return `${name}: ${problem.toLowerCase()}`;
        }
        return null;
      })
      .filter((p): p is string => p !== null);
    if (problems.length > 0) {
      toast.error("Cannot return more than the site has in stock", {
        description: problems.join("; "),
      });
      return;
    }
    if (!acknowledged) {
      toast.error("Please confirm this return is accurate before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await addSiteReturn(
        {
          org_id: "",
          from_site_id: fromSite,
          to_warehouse_id: toWarehouse,
          origin_dispatch_id: null,
          status: "RETURNED",
          sender_name: senderName,
          sender_signature: senderName || "acknowledged",
          notes: null,
          created_by: "",
        },
        items.map((li) => ({ ...li, return_id: "" }))
      );
      toast.success("Site return created");
      router.push("/site-returns");
    } catch (err: unknown) {
      toast.error("Failed to create site return", {
        description: friendlyErrorMessage(err, "An unexpected error occurred."),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="New Site Return" description="Return goods from a site to a warehouse" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="New Site Return" description="Return goods from a site to a warehouse" />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted">Failed to load data.</p>
            <Button onClick={load}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Site Return"
        description="Return goods from a site back to a warehouse — only products in stock at that site"
        actions={
          <Button variant="secondary" onClick={() => router.push("/site-returns")}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardTitle>Return Details</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Returning Site"
                value={fromSite}
                onChange={(e) => handleSiteChange(e.target.value)}
                options={sites.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select site"
                required
              />
              <Select
                label="Destination Warehouse"
                value={toWarehouse}
                onChange={(e) => setToWarehouse(e.target.value)}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                placeholder="Select warehouse"
                required
              />
            </div>
            <Input
              label="Sender Name"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Who is sending back?"
              required
            />
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Return Items</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              <Plus size={14} /> Add Item
            </Button>
          </div>
          <CardContent className="mt-4 space-y-3">
            {lineItems.map((li, i) => {
              const problem = qtyProblem(li);
              return (
              <div key={i} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1">
                  <Select
                    label={i === 0 ? "Product" : ""}
                    value={li.product_id}
                    onChange={(e) => updateLine(i, "product_id", e.target.value)}
                    options={productOptions()}
                    placeholder={!fromSite ? "Select site first" : stockLoading ? "Loading stock…" : productOptions().length === 0 ? "No stock at this site" : "Select product"}
                  />
                </div>
                <div className="w-24">
                  <NumericInput
                    label={i === 0 ? "Qty" : ""}
                    value={li.quantity}
                    onChange={(v) => updateLine(i, "quantity", v)}
                    min={1}
                    error={problem ?? undefined}
                  />
                </div>
                <div className="w-44">
                  <Select
                    label={i === 0 ? "Reason" : ""}
                    value={li.reason}
                    onChange={(e) => updateLine(i, "reason", e.target.value)}
                    options={REASON_OPTIONS}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label={i === 0 ? "Condition Notes" : ""}
                    value={li.condition_notes}
                    onChange={(e) => updateLine(i, "condition_notes", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="p-2 text-muted hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border bg-card accent-primary"
              />
              <span className="text-sm text-foreground-dim">
                I confirm this return is accurate.
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/site-returns")}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Return
          </Button>
        </div>
      </form>
    </div>
  );
}
