"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { startAudit, completeAudit, fetchAudit } from "@/app/actions/auditActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchProducts, fetchProductStock } from "@/app/actions/productActions";
import { getProductIdParam, bestStockLocation } from "@/lib/quick-prefill";
import { PRODUCT_CATEGORIES } from "@/constants";
import type { Warehouse, Site, Product, Audit } from "@/types";

export default function NewAuditPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locationType, setLocationType] = useState<"WAREHOUSE" | "SITE">("WAREHOUSE");
  const [locationId, setLocationId] = useState("");
  const [category, setCategory] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  /** Quick Actions launch here with ?product=<id> — prefill the location holding it + its category. */
  async function prefillFromProductParam(allProducts: Product[], allWarehouses: Warehouse[], allSites: Site[]) {
    const paramId = getProductIdParam();
    const product = paramId ? allProducts.find((x) => x.id === paramId) : undefined;
    if (!product) return;
    setCategory(product.category ?? "");
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
      // Stock lookup is best-effort — the category is already prefilled.
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const locationOptions =
    locationType === "WAREHOUSE"
      ? warehouses.map((w) => ({ value: w.id, label: w.name }))
      : sites.map((s) => ({ value: s.id, label: s.name }));

  // Union of the canonical list and whatever categories actually exist on products.
  const categoryOptions = useMemo(() => {
    const present = new Set(products.map((p) => p.category).filter(Boolean) as string[]);
    for (const c of PRODUCT_CATEGORIES) present.add(c);
    const sorted = Array.from(present).sort();
    return [{ value: "", label: "All categories" }, ...sorted.map((c) => ({ value: c, label: c }))];
  }, [products]);

  const productMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      map[p.id] = `${p.name}${p.sku ? ` (${p.sku})` : ""}`;
    }
    return map;
  }, [products]);

  async function handleStart() {
    if (!locationId) return;
    setStarting(true);
    try {
      const result = await startAudit(locationType, locationId, category || undefined);
      const full = await fetchAudit(result.id);
      if (!full) {
        toast.error("Failed to load audit");
        return;
      }
      setAudit(full);
      const initial: Record<string, number> = {};
      for (const item of full.count_sheet) {
        initial[item.product_id] = 0;
      }
      setCounts(initial);
    } catch (err: unknown) {
      toast.error("Failed to start audit", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setStarting(false);
    }
  }

  async function handleComplete() {
    if (!audit) return;
    const auditCounts = Object.entries(counts).map(([product_id, actual]) => ({
      product_id,
      actual,
    }));
    setCompleting(true);
    try {
      const result = await completeAudit(audit.id, auditCounts, locationType, locationId);
      if (result.discrepancies.length > 0) {
        toast.success("Audit completed", {
          description: `${result.discrepancies.length} discrepancy(ies) reconciled.`,
        });
      } else {
        toast.info("No changes have been made", {
          description: "All counted quantities matched the current stock.",
        });
      }
      router.push("/audits");
    } catch (err: unknown) {
      toast.error("Failed to complete audit", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setCompleting(false);
    }
  }

  // Quick-fill: when a product's physical count matches the system's expected
  // quantity, copy expected straight into the counted field.
  function copyExpected(productId: string, expected: number) {
    setCounts((prev) => ({ ...prev, [productId]: expected }));
  }

  if (!dataLoaded && !loadError) {
    return (
      <div>
        <PageHeader title="New Stock Audit" description="Create a physical count session" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="New Stock Audit" description="Create a physical count session" />
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
        title="New Stock Audit"
        description="Create a physical count session"
        actions={
          <Button variant="secondary" onClick={() => router.push("/audits")}>
            Back
          </Button>
        }
      />

      <div className="space-y-6 max-w-3xl">
        {!audit && (
          <Card>
            <CardTitle>Audit Location</CardTitle>
            <CardContent className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Location Type"
                  value={locationType}
                  onChange={(e) => {
                    setLocationType(e.target.value as "WAREHOUSE" | "SITE");
                    // Reset in the event (not an effect) so a prefilled location survives load.
                    setLocationId("");
                  }}
                  options={[
                    { value: "WAREHOUSE", label: "Warehouse" },
                    { value: "SITE", label: "Site" },
                  ]}
                />
                <Select
                  label="Location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  options={locationOptions}
                  placeholder={`Select ${locationType.toLowerCase()}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  options={categoryOptions}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleStart} loading={starting} disabled={!locationId}>
                  Start Count
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {audit && (
          <Card>
            <CardTitle>Count Sheet</CardTitle>
            <CardContent className="mt-4 space-y-3">
              {audit.count_sheet.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">
                  {category
                    ? `No products found in "${category}" at this location.`
                    : "No products found at this location."}
                </p>
              ) : (
                audit.count_sheet.map((item) => (
                  <div key={item.product_id} className="flex gap-3 items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {productMap[item.product_id] || item.product_id}
                      </p>
                    </div>
                    <div className="w-24 text-right">
                      <p className="text-sm text-muted">Expected: {item.expected}</p>
                    </div>
                    <div className="w-28">
                      <NumericInput
                        value={counts[item.product_id] ?? 0}
                        onChange={(v) =>
                          setCounts((prev) => ({
                            ...prev,
                            [item.product_id]: v,
                          }))
                        }
                        min={0}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyExpected(item.product_id, item.expected)}
                      title="Copy expected count"
                      aria-label="Copy expected count"
                      className="shrink-0"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                ))
              )}
              {audit.count_sheet.length > 0 && (
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button onClick={handleComplete} loading={completing}>
                    Complete Audit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
