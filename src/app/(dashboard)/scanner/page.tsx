"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Package, ScanBarcode, Search, History, Plus, X, Download, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { lookupBarcode, addProduct } from "@/app/actions/productActions";
import { Html5Qrcode } from "html5-qrcode";
import type { Product } from "@/types";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";
import { downloadCsv, formatCsvDate } from "@/lib/csv";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreatePurchaseOrder, canManageProduct } from "@/lib/permissions";

interface ScanHistoryItem {
  id: string;
  barcode: string;
  product: Product | null;
  timestamp: string;
  source: "camera" | "manual";
}

export default function ScannerPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManage = canManageProduct(user?.role);
  const canCreatePO = canCreatePurchaseOrder(user?.role);
  const [manual, setManual] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [searched, setSearched] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(true);
  const [scannable, setScannable] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductBarcode, setAddProductBarcode] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const lastDecodedRef = useRef("");

  const loadHistory = useCallback(() => {
    const saved = localStorage.getItem("scan-history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const saveHistory = useCallback((item: ScanHistoryItem) => {
    const newHistory = [item, ...history.slice(0, 49)];
    setHistory(newHistory);
    localStorage.setItem("scan-history", JSON.stringify(newHistory));
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem("scan-history");
  }, []);

  const lookup = useCallback(async (text: string, source: "camera" | "manual" = "manual") => {
    const value = text.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setLookingUp(true);
    try {
      const result = await lookupBarcode(value);
      setProduct(result);
      setSearched(true);
      saveHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        barcode: value,
        product: result,
        timestamp: new Date().toISOString(),
        source,
      });
    } catch {
      setProduct(null);
      setSearched(true);
      toast.error("Lookup failed", { description: "Could not reach the database. Please try again." });
      saveHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        barcode: value,
        product: null,
        timestamp: new Date().toISOString(),
        source,
      });
    } finally {
      busyRef.current = false;
      setLookingUp(false);
    }
  }, [history, saveHistory]);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (decodedText === lastDecodedRef.current) return;
          lastDecodedRef.current = decodedText;
          setProduct(null);
          setSearched(false);
          lookup(decodedText, "camera");
        },
        () => {}
      )
      .then(() => {
        if (cancelled) return;
        scanningRef.current = true;
        setScannable(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCameraError("Camera unavailable — check permissions or use manual entry.");
      })
      .finally(() => {
        if (!cancelled) setScannerLoading(false);
      });

    return () => {
      cancelled = true;
      if (scanningRef.current && scannerRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        });
      }
    };
  }, [lookup]);

  async function stopScanning() {
    if (scanningRef.current && scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scanningRef.current = false;
        setScannable(false);
      } catch {
        toast.error("Camera error", { description: "Camera could not be stopped." });
      }
    }
  }

  const handleManualSearch = () => {
    if (manual.trim()) {
      lookup(manual);
    }
  };

  const handleAddProductFromScan = () => {
    if (product) {
      setAddProductBarcode(product.barcode_value || product.sku);
    } else if (manual.trim()) {
      setAddProductBarcode(manual.trim());
    }
    setShowAddProduct(true);
    setShowHistory(false);
  };

  return (
    <div>
      <PageHeader
        title="QR / Barcode Lookup"
        description="Scan or type a barcode to look up a product"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowHistory(!showHistory)}>
              <History size={16} /> History
            </Button>
            {canManage && (
              <Button variant="secondary" onClick={() => router.push("/products")}>
                <Plus size={16} /> Add Product
              </Button>
            )}
          </div>
        }
      />

      {showHistory && (
        <div className="mb-6">
          <Card>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <CardTitle className="text-lg">Scan History</CardTitle>
              <div className="flex gap-2">
                {history.some(h => h.product) && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    const headers = ["Barcode", "Product", "SKU", "Status", "Timestamp", "Source"];
                    const rows = history.map(h => [
                      h.barcode,
                      h.product?.name || "Not found",
                      h.product?.sku || "",
                      h.product?.status || "",
                      formatCsvDate(h.timestamp),
                      h.source,
                    ]);
                    downloadCsv(`scan-history-${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
                  }}>
                    <Download size={14} className="mr-1" /> Export
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-danger">
                  <Trash2 size={14} className="mr-1" /> Clear
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                  <X size={14} />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <History size={32} className="mx-auto mb-2" />
                  <p className="text-sm">No scan history yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-card-hover transition-colors"
                      onClick={() => item.product && router.push(`/products/${item.product.id}`)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 shrink-0">
                        {item.product ? <Package size={20} className="text-primary" /> : <AlertTriangle size={20} className="text-danger" />}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer">
                        <p className="font-medium truncate">{item.product?.name || `Not found: ${item.barcode}`}</p>
                        <p className="text-xs text-muted flex items-center gap-2">
                          <span>{item.product ? `SKU: ${item.product.sku}` : "No match"}</span>
                          <span>•</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          <Badge variant={item.source === "camera" ? "info" : "default"} className="text-xs">
                            {item.source === "camera" ? "📷 Camera" : "⌨️ Manual"}
                          </Badge>
                        </p>
                      </div>
                      {item.product && (
                        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/products/${item.product!.id}`); }}>
                          <ExternalLink size={14} /> View
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-lg">
        <Card>
          <CardTitle>Barcode Lookup</CardTitle>
          <CardContent className="mt-4 space-y-4">
            {cameraError && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted">
                <AlertTriangle size={16} className="text-danger shrink-0" />
                {cameraError}
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              <div id="reader" className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card" />
              {scannerLoading && !cameraError && <Spinner className="py-4" />}
              {scannable && (
                <Button variant="secondary" onClick={stopScanning}>
                  <ScanBarcode size={16} /> Stop Scanning
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="Or type / paste barcode"
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                />
              </div>
              <Button onClick={handleManualSearch} disabled={lookingUp || !manual.trim()}>
                <Search size={16} /> Search
              </Button>
            </div>

            {lookingUp && <Spinner className="py-4" />}

            {!lookingUp && searched && !product && (
              <div className="text-center py-8 text-muted">
                <Package size={32} className="mx-auto mb-2" />
                <p className="text-sm">No product found for this barcode.</p>
                {canManage && (
                  <Button variant="secondary" className="mt-2" onClick={handleAddProductFromScan}>
                    <Plus size={14} className="mr-1" /> Add Product with This Barcode
                  </Button>
                )}
              </div>
            )}

            {!lookingUp && product && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                    <Package size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-xs text-muted">SKU: {product.sku}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted">Brand</span>
                    <p className="font-medium">{product.brand || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted">Category</span>
                    <p className="font-medium">{product.category || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted">Unit</span>
                    <p className="font-medium">{product.unit}</p>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted">Status</span>
                  <div className="mt-1">
                    <Badge variant={product.status === "ACTIVE" ? "success" : "danger"}>
                      {product.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/products/${product.id}`)}>
                    <ExternalLink size={14} /> View Detail
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/products/${product.id}/barcode`)}>
                    <ScanBarcode size={14} /> Generate Barcode
                  </Button>
                  {canCreatePO && (
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/purchase-orders/new?product=${product.id}`)}>
                      <Plus size={14} /> Create PO
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <AddProductModal
          open={showAddProduct}
          onClose={() => { setShowAddProduct(false); setAddProductBarcode(""); }}
          initialBarcode={addProductBarcode}
        />
      )}
    </div>
  );
}

function AddProductModal({ open, onClose, initialBarcode }: { 
  open: boolean; 
  onClose: () => void; 
  initialBarcode: string;
}) {
  const [form, setForm] = useState({ 
    name: "", 
    sku: "", 
    brand: "", 
    model: "", 
    category: "",
    unit: "pcs", 
    barcode_value: "",
    reorder_point: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ 
        name: "", 
        sku: "", 
        brand: "", 
        model: "", 
        category: "",
        unit: "pcs", 
        barcode_value: initialBarcode || "",
        reorder_point: 0,
      });
    }
  }, [open, initialBarcode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await addProduct({
        name: form.name.trim(),
        sku: form.sku.trim(),
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        category: form.category.trim() || null,
        color: null,
        size: null,
        unit: form.unit.trim() || "pcs",
        barcode_value: form.barcode_value.trim() || null,
        barcode_format: form.barcode_value.trim() ? "CODE128" : null,
        reorder_point: form.reorder_point,
        base_cost_mmk: 0,
        last_purchase_cost_mmk: 0,
        upc_eans: [],
        status: "ACTIVE",
      });
      if (!form.barcode_value.trim() && created.barcode_value) {
        toast.success("Product created", { description: `Auto-generated barcode: ${created.barcode_value}` });
      } else {
        toast.success("Product created");
      }
      onClose();
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Failed to create product"));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Product</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-card-hover">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </div>
          <div>
            <Input
              label="Barcode Value"
              value={form.barcode_value}
              onChange={(e) => setForm({ ...form, barcode_value: e.target.value })}
              placeholder="Leave blank to auto-generate"
            />
            <p className="mt-1 text-xs text-muted">
              Leave blank to auto-generate a unique EAN-13 barcode. You can print it as a barcode or QR code.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              list="scanner-category-suggestions"
              placeholder="e.g. PPE, Tools, Materials"
            />
            <datalist id="scanner-category-suggestions">
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              options={PRODUCT_UNITS.map((u) => ({ value: u, label: u }))}
            />
            <NumericInput
              label="Reorder Point"
              value={form.reorder_point}
              onChange={(v) => setForm({ ...form, reorder_point: v })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading}>Create Product</Button>
          </div>
        </form>
      </div>
    </div>
  );
}