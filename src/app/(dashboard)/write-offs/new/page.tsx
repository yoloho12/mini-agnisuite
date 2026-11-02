"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { addWriteOff } from "@/app/actions/writeOffActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchProducts, fetchProductStock } from "@/app/actions/productActions";
import { getProductIdParam, bestStockLocation } from "@/lib/quick-prefill";
import { cn } from "@/lib/utils";
import type { Warehouse, Site, Product } from "@/types";

export default function NewWriteOffPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locationType, setLocationType] = useState<"WAREHOUSE" | "SITE">("WAREHOUSE");
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [available, setAvailable] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      setLoadError(null);
      const [w, s, p] = await Promise.all([fetchWarehouses(), fetchSites(), fetchProducts()]);
      setWarehouses(w);
      setSites(s);
      setProducts(p);
      setDataLoaded(true);
      await prefillFromProductParam(p, w, s);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  /** Quick Actions launch here with ?product=<id> — prefill product + fullest location. */
  async function prefillFromProductParam(allProducts: Product[], allWarehouses: Warehouse[], allSites: Site[]) {
    const paramId = getProductIdParam();
    const product = paramId ? allProducts.find((x) => x.id === paramId) : undefined;
    if (!product) return;
    setProductId(product.id);
    try {
      const stockRows = await fetchProductStock(product.id);
      const best = bestStockLocation(stockRows);
      if (!best) return;
      const known =
        best.location_type === "WAREHOUSE"
          ? allWarehouses.some((wh) => wh.id === best.location_id)
          : allSites.some((st) => st.id === best.location_id);
      if (known) {
        setLocationType(best.location_type);
        setLocationId(best.location_id);
      }
    } catch {
      // Stock lookup is best-effort — the product is already prefilled.
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Live availability at the selected location — powers the over-write-off
  // guard so stock can never go negative. State is cleared in the change
  // handlers (events), not synchronously inside the effect.
  useEffect(() => {
    if (!locationId || !productId) return;
    let cancelled = false;
    fetchProductStock(productId)
      .then((rows) => {
        if (cancelled) return;
        const row = rows.find(
          (r) => r.location_type === locationType && r.location_id === locationId
        );
        setAvailable(row?.quantity ?? 0);
      })
      .catch(() => {
        if (!cancelled) setAvailable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, productId, locationType]);

  function handleTypeChange(type: "WAREHOUSE" | "SITE") {
    setLocationType(type);
    setLocationId("");
    setAvailable(null);
  }

  function handleLocationChange(id: string) {
    setLocationId(id);
    setAvailable(null);
  }

  function handleProductChange(id: string) {
    setProductId(id);
    setAvailable(null);
  }

  const locationOptions =
    locationType === "WAREHOUSE"
      ? warehouses.map((w) => ({ value: w.id, label: w.name }))
      : sites.map((s) => ({ value: s.id, label: s.name }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) {
      toast.error("Select a location");
      return;
    }
    if (!productId) {
      toast.error("Select a product");
      return;
    }
    if (!reason) {
      toast.error("Select a reason");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Quantity must be a whole number greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      const result = await addWriteOff(locationType, locationId, productId, quantity, reason, notes || null);
      const clamped = result.quantity < quantity;
      toast.success("Write-off created", {
        description: clamped
          ? `Wrote off ${result.quantity} — only that much was in stock.`
          : "Stock write-off has been recorded.",
      });
      router.push("/write-offs");
    } catch (err: unknown) {
      toast.error("Failed to create write-off", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
      // Stock may have changed — refresh the availability suggestion.
      if (locationId && productId) {
        fetchProductStock(productId)
          .then((rows) => {
            const row = rows.find(
              (r) => r.location_type === locationType && r.location_id === locationId
            );
            setAvailable(row?.quantity ?? 0);
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
        <PageHeader title="New Write-off" description="Log damaged, expired, or lost stock" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="New Write-off" description="Log damaged, expired, or lost stock" />
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
        title="New Write-off"
        description="Log damaged, expired, or lost stock"
        actions={
          <Button variant="secondary" onClick={() => router.push("/write-offs")}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardTitle>Write-off Details</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Location Type"
                value={locationType}
                onChange={(e) => handleTypeChange(e.target.value as "WAREHOUSE" | "SITE")}
                options={[
                  { value: "WAREHOUSE", label: "Warehouse" },
                  { value: "SITE", label: "Site" },
                ]}
              />
              <Select
                label="Location"
                value={locationId}
                onChange={(e) => handleLocationChange(e.target.value)}
                options={locationOptions}
                placeholder={`Select ${locationType.toLowerCase()}`}
              />
            </div>
            <Select
              label="Product"
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              options={products.map((p) => ({ value: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}${p.category ? ` — ${p.category}` : ""}` }))}
              placeholder="Select product"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <NumericInput
                  label="Quantity"
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  className={cn(available !== null && quantity > available && "border-danger focus:ring-danger/50")}
                />
                {productId && locationId && (
                  <button
                    type="button"
                    onClick={() => available !== null && available > 0 && setQuantity(available)}
                    disabled={available === null || available <= 0}
                    title={
                      available === null
                        ? "Loading availability…"
                        : available > 0
                          ? `Write off all ${available}`
                          : "No stock at this location"
                    }
                    className={cn(
                      "mt-1 text-xs rounded px-1 transition-colors",
                      available === null
                        ? "text-muted"
                        : available > 0
                          ? quantity > available
                            ? "text-danger cursor-default"
                            : "text-muted hover:text-primary cursor-pointer"
                          : "text-danger cursor-default"
                    )}
                  >
                    {available === null
                      ? "Checking stock…"
                      : available > 0
                        ? quantity > available
                          ? `Only ${available} in stock`
                          : `Available: ${available} — use all`
                        : "No stock at this location"}
                  </button>
                )}
              </div>
              <Select
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                options={[
                  { value: "DAMAGED", label: "Damaged" },
                  { value: "EXPIRED", label: "Expired" },
                  { value: "LOST", label: "Lost" },
                  { value: "OTHER", label: "Other" },
                ]}
                placeholder="Select reason"
              />
            </div>
            <Textarea
              label="Notes"
              id="writeoff-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/write-offs")}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Write-off
          </Button>
        </div>
      </form>
    </div>
  );
}
