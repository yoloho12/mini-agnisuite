"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Barcode, Package, AlertTriangle, Plus, Truck, RotateCcw, Trash2, Edit2, Activity, Printer, Download, ArrowLeftRight, TrendingUp, TrendingDown, Minus, QrCode, Copy, Undo2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Tabs, { TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import PriceInput from "@/components/ui/PriceInput";
import { fetchProduct, fetchProductStock, fetchPriceHistory, editProduct, removeProduct, updateProductPrice } from "@/app/actions/productActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchDispatches } from "@/app/actions/dispatchActions";
import { fetchSiteReturns } from "@/app/actions/siteReturnActions";
import { fetchTransfers } from "@/app/actions/transferActions";
import { fetchWriteOffs } from "@/app/actions/writeOffActions";
import type { Product, ProductStatus, BarcodeFormat, StockLevel, Warehouse, Site, Dispatch, SiteReturn, StockTransfer, WriteOff, PriceHistory } from "@/types";
import { PRODUCT_UNITS } from "@/constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  canCreateAudit,
  canCreateDispatch,
  canCreatePurchaseOrder,
  canCreateSiteReturn,
  canCreateSupplierReturn,
  canCreateTransfer,
  canCreateWriteOff,
  canManageProduct,
  canOperate,
} from "@/lib/permissions";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatMmk } from "@/lib/money";
import { isValidEan13 } from "@/lib/barcode";
import bwipjs from "bwip-js";

const stockStatusVariant: Record<StockLevel["status"], "success" | "warning" | "danger"> = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [returns, setReturns] = useState<SiteReturn[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);
  const [costHistory, setCostHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const { user } = useCurrentUser();
  const canManage = canManageProduct(user?.role);
  const canOperateDoc = canOperate(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const id = params.id as string;
      const p = await fetchProduct(id);
      setProduct(p);
      if (p) {
        const [stockRows, whList, siteList, dispatchList, returnList, transferList, woList, costRows] = await Promise.all([
          fetchProductStock(p.id),
          fetchWarehouses(),
          fetchSites(),
          fetchDispatches(),
          fetchSiteReturns(),
          fetchTransfers(),
          fetchWriteOffs(),
          fetchPriceHistory(p.id),
        ]);
        setStock(stockRows);
        setWarehouses(whList);
        setSites(siteList);
        setDispatches(dispatchList.filter(d => d.from_warehouse_id === p.id || d.to_site_id === p.id)); // This won't work without location in dispatch
        setReturns(returnList);
        setTransfers(transferList);
        setWriteOffs(woList.filter(w => w.product_id === p.id));
        setCostHistory(costRows);
      }
    } catch {
      setError("Failed to load product details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle size={32} className="text-danger mb-3" />
        <p className="text-sm text-muted mb-4 max-w-sm">{error}</p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  if (!product) {
    return <div className="text-center py-12 text-muted">Product not found</div>;
  }

  const warehouseNames = new Map(warehouses.map((w) => [w.id, w.name]));
  const siteNames = new Map(sites.map((s) => [s.id, s.name]));

  function locationLabel(row: StockLevel) {
    if (row.location_type === "WAREHOUSE") {
      return { prefix: "Warehouse", name: warehouseNames.get(row.location_id) || "Unknown" };
    }
    return { prefix: "Site", name: siteNames.get(row.location_id) || "Unknown" };
  }

  const stockColumns = [
    { key: "location", header: "Location", render: (row: StockLevel) => {
      const { prefix, name } = locationLabel(row);
      return (
        <span>
          <span className="text-xs text-muted uppercase">{prefix}</span>
          <div className="font-medium">{name}</div>
        </span>
      );
    }},
    { key: "quantity", header: "Quantity", render: (row: StockLevel) => <span>{row.quantity}</span> },
    { key: "status", header: "Status", render: (row: StockLevel) => <Badge variant={stockStatusVariant[row.status]}>{row.status}</Badge> },
  ];

  interface MovementRow {
    type: string;
    reference: string;
    location: string;
    qty: string;
    date: string | null | undefined;
    created_at?: string | null;
    dispatched_at?: string | null;
    received_at?: string | null;
  }

  const movementColumns = [
    { key: "date", header: "Date", render: (row: MovementRow) => formatDate(row.created_at || row.dispatched_at || row.received_at) },
    { key: "type", header: "Type", render: (row: MovementRow) => row.type },
    { key: "reference", header: "Reference", render: (row: MovementRow) => row.reference },
    { key: "location", header: "Location", render: (row: MovementRow) => row.location },
    { key: "qty", header: "Qty", render: (row: MovementRow) => row.qty },
  ];

  const costHistoryColumns = [
    { key: "recorded_at", header: "Date", render: (row: PriceHistory) => formatDate(row.recorded_at) },
    { key: "cost_mmk", header: "Cost", render: (row: PriceHistory) => <span className="font-medium">{formatMmk(row.cost_mmk)}</span> },
    { key: "usd_rate", header: "USD Rate", render: (row: PriceHistory) => (row.usd_rate ? formatMmk(row.usd_rate) : "-") },
    { key: "source", header: "Source", render: (row: PriceHistory) => (
      <Badge variant={row.source === "PO" ? "info" : "default"}>{row.source === "PO" ? "Purchase Order" : "Manual"}</Badge>
    ) },
  ];

  const costTrend: "up" | "down" | "stable" =
    costHistory.length < 2
      ? "stable"
      : costHistory[0].cost_mmk > costHistory[1].cost_mmk
        ? "up"
        : costHistory[0].cost_mmk < costHistory[1].cost_mmk
          ? "down"
          : "stable";
  const trendMeta = {
    up: { icon: TrendingUp, label: "Rising", variant: "warning" as const },
    down: { icon: TrendingDown, label: "Falling", variant: "success" as const },
    stable: { icon: Minus, label: "Stable", variant: "default" as const },
  }[costTrend];
  const TrendIcon = trendMeta.icon;

  const allMovements: MovementRow[] = [];

  // Add dispatches
  dispatches.forEach(d => {
    allMovements.push({
      type: "Dispatch",
      reference: d.dispatch_number,
      location: warehouseNames.get(d.from_warehouse_id) || "Unknown",
      qty: "-",
      date: d.dispatched_at,
      created_at: d.dispatched_at,
    });
  });

  // Add site returns
  returns.forEach(r => {
    allMovements.push({
      type: "Site Return",
      reference: r.return_number,
      location: siteNames.get(r.from_site_id) || "Unknown",
      qty: "-",
      date: r.created_at,
      created_at: r.created_at,
    });
  });

  // Add transfers
  transfers.forEach(t => {
    allMovements.push({
      type: "Transfer",
      reference: t.transfer_number,
      location: `${warehouseNames.get(t.from_warehouse_id) || "WH"} → ${warehouseNames.get(t.to_warehouse_id) || "WH"}`,
      qty: "-",
      date: t.created_at,
      created_at: t.created_at,
    });
  });

  // Add write-offs
  writeOffs.forEach(w => {
    allMovements.push({
      type: "Write-off",
      reference: w.id.slice(0, 8),
      location: `${w.location_type === "WAREHOUSE" ? "WH" : "Site"}: ${warehouseNames.get(w.location_id) || siteNames.get(w.location_id) || w.location_id}`,
      qty: `-${w.quantity}`,
      date: w.created_at,
      created_at: w.created_at,
    });
  });

  allMovements.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={product.name}
          description="Product Detail"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/products")}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button onClick={() => router.push(`/products/${product.id}/barcode`)}>
              <Barcode size={16} /> Barcode
            </Button>
            {canManage && (
              <Button variant="secondary" onClick={() => { setEditForm({
                name: product.name,
                sku: product.sku,
                brand: product.brand || "",
                model: product.model || "",
                category: product.category || "",
                color: product.color || "",
                size: product.size || "",
                unit: product.unit,
                barcode_value: product.barcode_value || "",
                barcode_format: product.barcode_format,
                reorder_point: product.reorder_point,
                base_cost_mmk: product.base_cost_mmk,
                last_purchase_cost_mmk: product.last_purchase_cost_mmk,
                upc_eans: product.upc_eans,
                status: product.status,
              }); setShowEditModal(true); }}>
                <Edit2 size={16} /> Edit
              </Button>
            )}
            {canManage && (
              <Button onClick={() => {
                if (confirm("Delete this product? This cannot be undone.")) {
                  removeProduct(product.id)
                    .then(() => {
                      toast.success("Product deleted");
                      router.push("/products");
                    })
                    .catch((err) => toast.error(friendlyErrorMessage(err, "Failed to delete product")));
                }
              }} variant="danger">
                <Trash2 size={16} /> Delete
              </Button>
            )}
          </div>
        }
      />
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className={`grid w-full no-print ${canManage ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          {canManage && <TabsTrigger value="cost">Cost History</TabsTrigger>}
          <TabsTrigger value="barcode">Barcode</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mt-6">
            <Card>
              <CardTitle>Product Information</CardTitle>
              <CardContent className="mt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted">SKU</span>
                  <span className="text-sm font-medium">{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Brand</span>
                  <span className="text-sm font-medium">{product.brand || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Model</span>
                  <span className="text-sm font-medium">{product.model || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Category</span>
                  {product.category ? (
                    <Badge variant="info">{product.category}</Badge>
                  ) : (
                    <span className="text-sm font-medium">-</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Color</span>
                  <span className="text-sm font-medium">{product.color || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Size</span>
                  <span className="text-sm font-medium">{product.size || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Unit</span>
                  <span className="text-sm font-medium">{product.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Status</span>
                  <Badge variant={product.status === "ACTIVE" ? "success" : "danger"}>
                    {product.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Barcode</span>
                  <span className="text-sm font-medium">{product.barcode_value || product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Barcode Format</span>
                  <span className="text-sm font-medium">{product.barcode_format || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Reorder Point</span>
                  <span className="text-sm font-medium">{product.reorder_point}</span>
                </div>
                {canManage && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">Base Cost</span>
                    <span className="text-sm font-medium">{formatMmk(product.base_cost_mmk)}</span>
                  </div>
                )}
                {canManage && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">Last Purchase Cost</span>
                    <span className="text-sm font-medium">{formatMmk(product.last_purchase_cost_mmk)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted">UPC/EANs</span>
                  <span className="text-sm font-medium">{product.upc_eans.join(", ") || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted">Created</span>
                  <span className="text-sm font-medium">{formatDate(product.created_at)}</span>
                </div>
              </CardContent>
            </Card>

            {(canManage || canOperateDoc) && (
            <Card>
              <CardTitle>Quick Actions</CardTitle>
              <CardContent className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {canManage && (
                    <Button variant="secondary" onClick={() => setShowPriceModal(true)}>
                      <TrendingUp size={16} className="mr-1" /> Update Price
                    </Button>
                  )}
                  {canOperateDoc && (
                    <>
                      {canCreatePurchaseOrder(user?.role) && (
                        <Button variant="secondary" onClick={() => router.push(`/purchase-orders/new?product=${product.id}`)}>
                          <Plus size={16} className="mr-1" /> Create PO
                        </Button>
                      )}
                      {canCreateDispatch(user?.role) && (
                        <Button variant="secondary" onClick={() => router.push(`/dispatches/new?product=${product.id}`)}>
                          <Truck size={16} className="mr-1" /> Create Dispatch
                        </Button>
                      )}
                      {canCreateSiteReturn(user?.role) && (
                        <Button variant="secondary" onClick={() => router.push(`/site-returns/new?product=${product.id}`)}>
                          <RotateCcw size={16} className="mr-1" /> Site Return
                        </Button>
                      )}
                      {canCreateTransfer(user?.role) && (
                        <Button variant="secondary" onClick={() => router.push(`/transfers/new?product=${product.id}`)}>
                          <ArrowLeftRight size={16} className="mr-1" /> Transfer
                        </Button>
                      )}
                      {canCreateSupplierReturn(user?.role) && (
                        <Button variant="secondary" onClick={() => router.push(`/returns/new?product=${product.id}`)}>
                          <Undo2 size={16} className="mr-1" /> Supplier Return
                        </Button>
                      )}
                      {canCreateWriteOff(user?.role) && (
                        <Button variant="secondary" onClick={() => router.push(`/write-offs/new?product=${product.id}`)}>
                          <Trash2 size={16} className="mr-1" /> Write-off
                        </Button>
                      )}
                      {canCreateAudit(user?.role) && (
                        <Button variant="secondary" onClick={() => router.push(`/audits/new?product=${product.id}`)}>
                          <Activity size={16} className="mr-1" /> Audit
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardTitle>Stock Across Locations</CardTitle>
            <CardContent className="mt-4">
              {stock.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No stock levels"
                  description="No stock has been recorded for this product yet."
                />
              ) : (
                <Table
                  columns={stockColumns}
                  data={stock}
                  emptyMessage="No stock data"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardTitle>Movement History</CardTitle>
            <CardContent className="mt-4">
              {allMovements.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No movements yet"
                  description="This product hasn't been moved between locations yet."
                />
              ) : (
                <Table
                  columns={movementColumns}
                  data={allMovements}
                  emptyMessage="No movement data"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="cost">
            <Card>
              <CardTitle className="flex items-center justify-between">
                <span>Cost History</span>
                <div className="flex items-center gap-2">
                  <Badge variant={trendMeta.variant}>
                    <TrendIcon size={12} className="mr-1" /> {trendMeta.label}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={() => setShowPriceModal(true)}>
                    <TrendingUp size={14} className="mr-1" /> Update Price
                  </Button>
                </div>
              </CardTitle>
              <CardContent className="mt-4">
                {costHistory.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No cost history yet"
                    description="Costs are recorded here automatically when purchase orders are received, or when the last purchase cost is edited manually."
                  />
                ) : (
                  <Table
                    columns={costHistoryColumns}
                    data={costHistory}
                    emptyMessage="No cost data"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="barcode">
          <BarcodeView key={`${product.id}-${product.barcode_format ?? "none"}`} product={product} />
        </TabsContent>
      </Tabs>

      {showEditModal && canManage && (
        <EditProductModal
          open={showEditModal}
          onClose={() => { setShowEditModal(false); setEditForm({}); }}
          onSuccess={load}
          initialData={product}
          formData={editForm}
          setFormData={setEditForm}
        />
      )}

      {showPriceModal && canManage && (
        <UpdatePriceModal
          onClose={() => setShowPriceModal(false)}
          onSuccess={load}
          product={product}
          totalQty={stock.reduce((sum, s) => sum + s.quantity, 0)}
        />
      )}
    </div>
  );
}

function BarcodeView({ product }: { product: Product }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"barcode" | "qr">(product.barcode_format === "QR" ? "qr" : "barcode");
  const [barcodeError, setBarcodeError] = useState("");
  const value = product.barcode_value || product.sku;
  // Seeded/demo EAN-13 values are not always check-digit valid; Code128 can
  // encode any value, so only use EAN-13 when the value actually supports it.
  const barcodeFormat = product.barcode_format === "EAN13" && isValidEan13(value) ? "ean13" : "code128";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (mode === "qr") {
        bwipjs.toCanvas(canvas, {
          bcid: "qrcode",
          text: value,
          scale: 4,
          padding: 4,
        });
      } else {
        bwipjs.toCanvas(canvas, {
          bcid: barcodeFormat,
          text: value,
          scale: 3,
          height: 12,
          includetext: true,
          textxalign: "center",
        });
      }
      setBarcodeError("");
    } catch {
      setBarcodeError(
        mode === "qr"
          ? "Could not render the QR code for this value."
          : "Could not render the barcode for this value."
      );
    }
  }, [mode, value, barcodeFormat]);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Barcode value copied to clipboard");
    } catch {
      toast.error("Could not copy the barcode value");
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${product.sku}-${mode === "qr" ? "qr" : "barcode"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="print-area max-w-md mx-auto">
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2 no-print" role="group" aria-label="Label type">
            <Button
              size="sm"
              variant={mode === "barcode" ? "primary" : "secondary"}
              aria-pressed={mode === "barcode"}
              onClick={() => setMode("barcode")}
            >
              <Barcode size={14} /> Barcode
            </Button>
            <Button
              size="sm"
              variant={mode === "qr" ? "primary" : "secondary"}
              aria-pressed={mode === "qr"}
              onClick={() => setMode("qr")}
            >
              <QrCode size={14} /> QR Code
            </Button>
          </div>
          <h3 className="text-lg font-semibold text-center print:text-black">{product.name}</h3>
          <canvas ref={canvasRef} className="w-full max-w-md" />
          {barcodeError ? (
            <p className="text-sm text-danger">{barcodeError}</p>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted print:text-black">SKU: {product.sku}</p>
              <p className="text-xs text-muted print:text-black">Value: {value}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border w-full justify-center no-print">
            <Button variant="secondary" onClick={copyValue}>
              <Copy size={16} /> Copy Value
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print Label
            </Button>
            <Button variant="secondary" onClick={downloadPng}>
              <Download size={16} /> Download PNG
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function UpdatePriceModal({
  onClose,
  onSuccess,
  product,
  totalQty,
}: {
  onClose: () => void;
  onSuccess: () => void;
  product: Product;
  totalQty: number;
}) {
  const [price, setPrice] = useState(product.last_purchase_cost_mmk);
  const [saving, setSaving] = useState(false);
  const delta = (price - product.last_purchase_cost_mmk) * totalQty;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProductPrice(product.id, price);
      toast.success("Price updated", {
        description: `Value price set to ${formatMmk(price)} — recorded in cost history and dashboard valuation.`,
      });
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Failed to update price"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Update Value Price">
      <form onSubmit={handleSave} className="space-y-4">
        <p className="text-sm text-muted">
          The value price is used for stock valuation (growth over cost basis) across the app. It is recorded
          in this product&apos;s cost history as a manual entry.
        </p>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Current price</span>
          <span className="font-medium">{formatMmk(product.last_purchase_cost_mmk)}</span>
        </div>
        <PriceInput
          label="New Value Price (MMK)"
          value={price}
          onChange={setPrice}
          previousValue={product.last_purchase_cost_mmk}
        />
        <div className="flex justify-between text-sm p-3 rounded-lg bg-card-hover">
          <span className="text-muted">Stock value impact ({totalQty.toLocaleString()} units)</span>
          <span className={`font-medium ${delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted"}`}>
            {delta > 0 ? "+" : ""}{formatMmk(delta)}
          </span>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={price === product.last_purchase_cost_mmk || price <= 0}>
            Save Price
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditProductModal({ open, onClose, onSuccess, initialData, formData, setFormData }: { 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  initialData: Product | null;
  formData: Partial<Product>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Product>>>;
}) {
  if (!open || !initialData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await editProduct(initialData.id, { ...formData, category: (formData.category as string)?.trim() || null });
      toast.success("Product updated");
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Failed to update product"));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Product" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name *" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <Input label="SKU *" value={formData.sku || ""} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Brand" value={formData.brand || ""} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
          <Input label="Model" value={formData.model || ""} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
        </div>
        <Input label="Category" value={formData.category || ""} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="e.g. PPE, Tools, Materials" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Color" value={formData.color || ""} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
          <Input label="Size" value={formData.size || ""} onChange={(e) => setFormData({ ...formData, size: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Unit"
            value={formData.unit || ""}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            options={PRODUCT_UNITS.map((u) => ({ value: u, label: u }))}
          />
          <Input label="Barcode Value" value={formData.barcode_value || ""} onChange={(e) => setFormData({ ...formData, barcode_value: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Barcode Format"
            value={formData.barcode_format || ""}
            onChange={(e) => setFormData({ ...formData, barcode_format: (e.target.value as BarcodeFormat) || null })}
            options={[
              { value: "", label: "Auto (EAN-13 / detect)" },
              { value: "CODE128", label: "Code128" },
              { value: "EAN13", label: "EAN-13" },
              { value: "QR", label: "QR Code" },
            ]}
          />
          <NumericInput
            label="Reorder Point"
            value={formData.reorder_point || 0}
            onChange={(v) => setFormData({ ...formData, reorder_point: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <PriceInput
            label="Base Cost (MMK)"
            value={formData.base_cost_mmk || 0}
            onChange={(v) => setFormData({ ...formData, base_cost_mmk: v })}
            previousValue={initialData.base_cost_mmk}
          />
          <PriceInput
            label="Last Cost (MMK)"
            value={formData.last_purchase_cost_mmk || 0}
            onChange={(v) => setFormData({ ...formData, last_purchase_cost_mmk: v })}
            previousValue={initialData.last_purchase_cost_mmk}
          />
        </div>
        <Select
          label="Status"
          value={formData.status || "ACTIVE"}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as ProductStatus })}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "DISCONTINUED", label: "Discontinued" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}