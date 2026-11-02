"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { addTransfer } from "@/app/actions/transferActions";
import { fetchWarehouses, fetchWarehouseStockLevels } from "@/app/actions/warehouseActions";
import { fetchProducts, fetchProductStock } from "@/app/actions/productActions";
import { getProductIdParam, bestLocation, qtyAt } from "@/lib/quick-prefill";
import { cn } from "@/lib/utils";
import type { Warehouse, Product } from "@/types";

interface LineItem {
  product_id: string;
  quantity: number;
}

export default function NewTransferPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ product_id: "", quantity: 1 }]);
  const [sourceStock, setSourceStock] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      setLoadError(null);
      const [w, p] = await Promise.all([fetchWarehouses(), fetchProducts()]);
      setWarehouses(w);
      setProducts(p);
      setDataLoaded(true);
      await prefillFromProductParam(p, w);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  /** Quick Actions launch here with ?product=<id> — prefill both warehouses and the line. */
  async function prefillFromProductParam(allProducts: Product[], allWarehouses: Warehouse[]) {
    const paramId = getProductIdParam();
    const product = paramId ? allProducts.find((x) => x.id === paramId) : undefined;
    if (!product) return;
    setLineItems([{ product_id: product.id, quantity: 1 }]);
    try {
      const stockRows = await fetchProductStock(product.id);
      const from = bestLocation(stockRows, "WAREHOUSE");
      if (!from || !allWarehouses.some((wh) => wh.id === from.location_id)) return;
      // Rebalance: fullest warehouse sends to the other warehouse that already
      // holds this product, else any other warehouse.
      const positiveOthers = stockRows.filter(
        (r) => r.location_type === "WAREHOUSE" && r.location_id !== from.location_id && r.quantity > 0
      );
      const fallback = allWarehouses.find((wh) => wh.id !== from.location_id);
      const toId =
        positiveOthers.length > 0
          ? positiveOthers.reduce((a, b) => (b.quantity > a.quantity ? b : a)).location_id
          : fallback?.id;
      const available = qtyAt(stockRows, "WAREHOUSE", from.location_id);
      setFromWarehouseId(from.location_id);
      setStockLoading(true);
      if (toId) setToWarehouseId(toId);
      setLineItems([{ product_id: product.id, quantity: available > 0 ? available : 1 }]);
    } catch {
      // Stock lookup is best-effort — the product line is already prefilled.
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Load live stock at the source warehouse whenever it changes — powers the
  // per-line availability suggestion and over-transfer validation.
  // Loading/clearing state is set in handleFromChange (event), not here.
  useEffect(() => {
    if (!fromWarehouseId) return;
    let cancelled = false;
    fetchWarehouseStockLevels(fromWarehouseId)
      .then((levels) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const l of levels) map[l.product_id] = l.quantity;
        setSourceStock(map);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load stock levels for the source warehouse");
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromWarehouseId]);

  function handleFromChange(id: string) {
    setFromWarehouseId(id);
    // Destination must remain a different warehouse.
    if (id && toWarehouseId === id) setToWarehouseId("");
    setStockLoading(Boolean(id));
    if (!id) setSourceStock({});
  }

  function availableFor(productId: string): number {
    return sourceStock[productId] ?? 0;
  }

  function addLine() {
    setLineItems([...lineItems, { product_id: "", quantity: 1 }]);
  }

  function removeLine(i: number) {
    setLineItems(lineItems.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], [field]: value };
    setLineItems(updated);
  }

  function handleProductChange(i: number, productId: string) {
    if (productId && lineItems.some((li, idx) => idx !== i && li.product_id === productId)) {
      toast.error("That product is already on another line — quantities are combined automatically if you keep it.");
      return;
    }
    updateLine(i, "product_id", productId);
  }

  /** Per-line problem text, or null when the line is fine. */
  function lineError(li: LineItem): string | null {
    if (!li.product_id) return null; // incomplete line — filtered at submit
    const qty = li.quantity;
    if (!Number.isInteger(qty) || qty < 1) return "Qty must be a whole number ≥ 1";
    if (!fromWarehouseId) return null; // availability unknown until source chosen
    const avail = availableFor(li.product_id);
    if (qty > avail) {
      return avail === 0 ? "No stock at source" : `Only ${avail} available`;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromWarehouseId) {
      toast.error("Select a source warehouse");
      return;
    }
    if (!toWarehouseId) {
      toast.error("Select a destination warehouse");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error("Source and destination must be different warehouses");
      return;
    }
    const filled = lineItems.filter((li) => li.product_id);
    if (filled.length === 0) {
      toast.error("Add at least one product to transfer");
      return;
    }
    const invalid = filled.filter((li) => lineError(li) !== null);
    if (invalid.length > 0) {
      toast.error("Fix the highlighted lines before creating the transfer", {
        description: lineError(invalid[0]) ?? undefined,
      });
      return;
    }
    // Aggregate duplicates so the same product on two lines transfers once.
    const qtyByProduct = new Map<string, number>();
    for (const li of filled) {
      qtyByProduct.set(li.product_id, (qtyByProduct.get(li.product_id) || 0) + li.quantity);
    }
    const aggregated = Array.from(qtyByProduct, ([product_id, quantity]) => ({ product_id, quantity }));

    setSubmitting(true);
    try {
      await addTransfer(fromWarehouseId, toWarehouseId, notes || null, aggregated);
      toast.success("Transfer created", {
        description: `Stock moved between warehouses. Quantities updated at both locations.`,
      });
      router.push("/transfers");
    } catch (err: unknown) {
      toast.error("Failed to create transfer", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
      // Stock may have changed since the form loaded — refresh suggestions.
      if (fromWarehouseId) {
        fetchWarehouseStockLevels(fromWarehouseId)
          .then((levels) => {
            const map: Record<string, number> = {};
            for (const l of levels) map[l.product_id] = l.quantity;
            setSourceStock(map);
          })
          .catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!dataLoaded && !loadError) {
    return (
      <div>
        <PageHeader title="New Stock Transfer" description="Move stock from one warehouse to another" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="New Stock Transfer" description="Move stock from one warehouse to another" />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted">{loadError}</p>
            <Button onClick={loadData}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const fromName = warehouses.find((w) => w.id === fromWarehouseId)?.name;

  return (
    <div>
      <PageHeader
        title="New Stock Transfer"
        description="Move stock from one warehouse to another"
        actions={
          <Button variant="secondary" onClick={() => router.push("/transfers")}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardTitle>Transfer Details</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="From Warehouse"
                value={fromWarehouseId}
                onChange={(e) => handleFromChange(e.target.value)}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                placeholder="Select source warehouse"
              />
              <Select
                label="To Warehouse"
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                options={warehouses.filter((w) => w.id !== fromWarehouseId).map((w) => ({ value: w.id, label: w.name }))}
                placeholder="Select destination warehouse"
              />
            </div>
            <Textarea
              label="Notes"
              id="transfer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              <Plus size={14} /> Add Item
            </Button>
          </div>
          <CardContent className="mt-4 space-y-3">
            {lineItems.map((li, i) => {
              const problem = lineError(li);
              const avail = li.product_id ? availableFor(li.product_id) : null;
              // Chip red state reflects availability only — the qty border
              // already turns red for any problem, so no error text below.
              const overAvailable =
                fromWarehouseId && avail !== null && Number.isInteger(li.quantity) && li.quantity > avail;
              return (
                <div key={i} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Select
                      label={i === 0 ? "Product" : ""}
                      value={li.product_id}
                      onChange={(e) => handleProductChange(i, e.target.value)}
                      options={products.map((p) => ({ value: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}${p.category ? ` — ${p.category}` : ""}` }))}
                      placeholder="Select product"
                    />
                  </div>
                  <div className="w-24">
                    <NumericInput
                      label={i === 0 ? "Qty" : ""}
                      value={li.quantity}
                      onChange={(v) => updateLine(i, "quantity", v)}
                      min={1}
                      className={cn(problem && "border-danger focus:ring-danger/50")}
                    />
                  </div>
                  {li.product_id && (
                    <button
                      type="button"
                      onClick={() => {
                        if (avail !== null && avail > 0) updateLine(i, "quantity", avail);
                      }}
                      disabled={!fromWarehouseId || stockLoading || (avail ?? 0) <= 0}
                      title={
                        !fromWarehouseId
                          ? "Select a source warehouse to see availability"
                          : (avail ?? 0) > 0
                            ? `Click to transfer all ${avail}`
                            : "No stock at source"
                      }
                      className={cn(
                        "pb-2.5 text-xs whitespace-nowrap rounded px-1 transition-colors",
                        overAvailable || (avail === 0 && fromWarehouseId && !stockLoading) ? "text-danger" : "text-muted",
                        !fromWarehouseId || stockLoading || (avail ?? 0) <= 0
                          ? "cursor-default"
                          : "hover:text-primary cursor-pointer"
                      )}
                    >
                      {stockLoading
                        ? "…"
                        : !fromWarehouseId
                          ? "Pick source"
                          : (avail ?? 0) > 0
                            ? (overAvailable ? `Only ${avail}` : `Available: ${avail}`)
                            : "No stock"}
                    </button>
                  )}
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="p-2 pb-2.5 text-muted hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
            {fromWarehouseId && !stockLoading && (
              <p className="text-xs text-muted">
                Availability shown for <span className="text-foreground">{fromName}</span>. Click an availability label to transfer the full amount.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/transfers")}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Transfer
          </Button>
        </div>
      </form>
    </div>
  );
}
