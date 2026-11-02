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
import { addSupplierReturn, fetchSupplierPurchasedProducts } from "@/app/actions/supplierReturnActions";
import { fetchContacts } from "@/app/actions/contactActions";
import { fetchWarehouseStockLevels, fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchProducts } from "@/app/actions/productActions";
import { cn } from "@/lib/utils";
import type { Contact, Warehouse, Product } from "@/types";

interface LineItem {
  product_id: string;
  quantity: number;
  unit_cost_mmk: number;
}

export default function NewSupplierReturnPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ product_id: "", quantity: 1, unit_cost_mmk: 0 }]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [purchasable, setPurchasable] = useState<Map<string, number>>(new Map());
  const [purchasableLoading, setPurchasableLoading] = useState(false);
  const [stockLevels, setStockLevels] = useState<Map<string, number>>(new Map());
  const [stockLoading, setStockLoading] = useState(false);

  async function loadData() {
    try {
      setLoadError(null);
      const [s, w, p] = await Promise.all([
        fetchContacts(undefined, "SUPPLIER"),
        fetchWarehouses(),
        fetchProducts(),
      ]);
      setSuppliers(s);
      setWarehouses(w);
      setProducts(p);
      setDataLoaded(true);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Load which products were purchased from the selected supplier; drop
  // line products that this supplier never sold us.
  useEffect(() => {
    if (!supplierId || !warehouseId) {
      setPurchasable(new Map());
      setPurchasableLoading(false);
      return;
    }
    let cancelled = false;
    setPurchasableLoading(true);
    fetchSupplierPurchasedProducts(supplierId, warehouseId)
      .then((list) => {
        if (cancelled) return;
        const map = new Map(list.map((r) => [r.product_id, r.last_unit_cost_mmk]));
        setPurchasable(map);
        setLineItems((prev) =>
          prev.map((li) =>
            li.product_id && !map.has(li.product_id) ? { ...li, product_id: "", unit_cost_mmk: 0 } : li
          )
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error("Failed to load supplier products", {
            description: err instanceof Error ? err.message : "An unexpected error occurred.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setPurchasableLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId, warehouseId]);

  // Load stock at the selected warehouse (return deducts from it).
  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    fetchWarehouseStockLevels(warehouseId)
      .then((levels) => {
        if (cancelled) return;
        setStockLevels(new Map(levels.map((l) => [l.product_id, l.quantity])));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error("Failed to load warehouse stock", {
            description: err instanceof Error ? err.message : "An unexpected error occurred.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  function handleSupplierChange(value: string) {
    setSupplierId(value);
    setPurchasable(new Map());
    setPurchasableLoading(Boolean(value));
    if (!value) {
      setLineItems((prev) => prev.map((li) => ({ ...li, product_id: "", unit_cost_mmk: 0 })));
    }
  }

  function handleWarehouseChange(value: string) {
    setWarehouseId(value);
    setStockLevels(new Map());
    setStockLoading(Boolean(value));
  }

  function addLine() {
    setLineItems([...lineItems, { product_id: "", quantity: 1, unit_cost_mmk: 0 }]);
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
    const updated = [...lineItems];
    // Prefill the unit cost we last paid this supplier for the product.
    updated[i] = {
      ...updated[i],
      product_id: productId,
      unit_cost_mmk: purchasable.get(productId) ?? updated[i].unit_cost_mmk,
    };
    setLineItems(updated);
  }

  function availableFor(productId: string): number | null {
    if (!warehouseId || stockLoading) return null;
    return stockLevels.get(productId) ?? 0;
  }

  const productOptions = products
    .filter((p) => {
      if (!purchasable.has(p.id)) return false;
      // Keep the current selection visible even if it drops out of stock.
      if (lineItems.some((li) => li.product_id === p.id)) return true;
      if (!warehouseId) return true;
      return (stockLevels.get(p.id) ?? 0) > 0;
    })
    .map((p) => ({
      value: p.id,
      label: `${p.name}${p.sku ? ` (${p.sku})` : ""}${p.category ? ` — ${p.category}` : ""}`,
    }));

  const productPlaceholder = !supplierId
    ? "Select supplier first"
    : purchasableLoading
      ? "Loading supplier products…"
      : purchasable.size === 0
        ? "No products purchased from this supplier"
        : warehouseId && productOptions.length === 0
          ? "No returnable stock at this warehouse"
          : "Select product";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Select a supplier");
      return;
    }
    if (!warehouseId) {
      toast.error("Select a warehouse");
      return;
    }
    if (!reason.trim()) {
      toast.error("Enter a reason for the return");
      return;
    }
    const validItems = lineItems.filter((li) => li.product_id && li.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one product to return");
      return;
    }
    const badLine = validItems.findIndex(
      (li) => !Number.isInteger(li.quantity) || li.quantity <= 0
    );
    if (badLine !== -1) {
      toast.error(`Line ${badLine + 1}: quantity must be a whole number greater than zero`);
      return;
    }

    setSubmitting(true);
    try {
      await addSupplierReturn(supplierId, warehouseId, reason, validItems);
      toast.success("Return created", { description: "Supplier return has been created successfully." });
      router.push("/returns");
    } catch (err: unknown) {
      toast.error("Failed to create return", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!dataLoaded && !loadError) {
    return (
      <div>
        <PageHeader title="Return to Supplier" description="Select goods to return to a supplier" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Return to Supplier" description="Select goods to return to a supplier" />
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
        title="Return to Supplier"
        description="Only products bought from this supplier and in stock at the warehouse can be returned"
        actions={
          <Button variant="secondary" onClick={() => router.push("/returns")}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardTitle>Return Details</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Supplier"
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select supplier"
              />
              <Select
                label="Warehouse"
                value={warehouseId}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                placeholder="Select warehouse"
              />
            </div>
            <Input
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for return"
            />
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              <Plus size={14} /> Add Item
            </Button>
          </div>
          <CardContent className="mt-4 space-y-3">
            {lineItems.map((li, i) => {
              const avail = li.product_id ? availableFor(li.product_id) : null;
              const overAvailable =
                warehouseId &&
                !stockLoading &&
                avail !== null &&
                Number.isInteger(li.quantity) &&
                li.quantity > avail;
              return (
                <div key={i} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Select
                      label={i === 0 ? "Product" : ""}
                      value={li.product_id}
                      onChange={(e) => handleProductChange(i, e.target.value)}
                      options={productOptions}
                      placeholder={productPlaceholder}
                    />
                  </div>
                  <div className="w-24">
                    <NumericInput
                      label={i === 0 ? "Qty" : ""}
                      value={li.quantity}
                      onChange={(v) => updateLine(i, "quantity", v)}
                      min={1}
                      className={cn(overAvailable && "border-danger focus:ring-danger/50")}
                    />
                  </div>
                  {li.product_id && (
                    <span
                      className={cn(
                        "pb-2.5 text-xs whitespace-nowrap rounded px-1",
                        stockLoading || !warehouseId
                          ? "text-muted"
                          : (avail ?? 0) > 0
                            ? overAvailable
                              ? "text-danger"
                              : "text-muted"
                            : "text-danger"
                      )}
                    >
                      {stockLoading
                        ? "…"
                        : !warehouseId
                          ? "Pick warehouse"
                          : (avail ?? 0) > 0
                            ? overAvailable
                              ? `Only ${avail}`
                              : `Available: ${avail}`
                            : "No stock"}
                    </span>
                  )}
                  <div className="w-32">
                    <PriceInput
                      label={i === 0 ? "Unit Cost (MMK)" : ""}
                      value={li.unit_cost_mmk}
                      onChange={(v) => updateLine(i, "unit_cost_mmk", v)}
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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/returns")}>
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
