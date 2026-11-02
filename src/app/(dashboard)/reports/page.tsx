"use client";

import { useEffect, useState, useMemo } from "react";
import { Printer, Download, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Table from "@/components/ui/Table";
import { fetchProducts, fetchStockLevels } from "@/app/actions/productActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchPurchaseOrders, fetchPOLineItems } from "@/app/actions/poActions";
import { fetchDispatches, fetchDispatchLineItems } from "@/app/actions/dispatchActions";
import { fetchSiteReturns, fetchSiteReturnLineItems } from "@/app/actions/siteReturnActions";
import { fetchTransfers, fetchTransferLineItems } from "@/app/actions/transferActions";
import { fetchContacts } from "@/app/actions/contactActions";
import { formatMmk } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { downloadCsv, formatCsvDate } from "@/lib/csv";
import type {
  Product, PurchaseOrder, Dispatch, SiteReturn, StockTransfer,
  StockLevel, Warehouse, Site, Contact,
} from "@/types";

type MovementType = "PO" | "Dispatch" | "Return" | "Transfer";
type BadgeVariant = "info" | "warning" | "success" | "default";

interface MovementRow {
  id: string;
  type: MovementType;
  reference: string;
  date: string;
  badgeVariant: BadgeVariant;
  fromLabel: string;
  toLabel: string;
}

interface DetailLine { name: string; qty: number }
interface MovementDetail { lines: DetailLine[]; totalQty: number }

const badgeFor: Record<MovementType, BadgeVariant> = {
  PO: "info",
  Dispatch: "warning",
  Return: "success",
  Transfer: "default",
};

function FocusButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={active ? "Exit focus mode" : "Enter focus mode"}
      title={active ? "Exit focus (Esc)" : "Focus mode"}
    >
      {active ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    </Button>
  );
}

export default function ReportsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [siteReturns, setSiteReturns] = useState<SiteReturn[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // "stock" | "movements" — the expanded, full-width table; null = side by side.
  const [focus, setFocus] = useState<"stock" | "movements" | null>(null);
  const [movementDetails, setMovementDetails] = useState<Record<string, MovementDetail | null>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);

  async function loadData() {
    try {
      setLoadError(null);
      setLoading(true);
      const [prods, levels, wh, st, sup, pos, dis, sr, tr] = await Promise.all([
        fetchProducts(),
        fetchStockLevels(),
        fetchWarehouses(),
        fetchSites(),
        fetchContacts(undefined, "SUPPLIER"),
        fetchPurchaseOrders(),
        fetchDispatches(),
        fetchSiteReturns(),
        fetchTransfers(),
      ]);
      setProducts(prods);
      setStockLevels(levels);
      setWarehouses(wh);
      setSites(st);
      setSuppliers(sup);
      setPurchaseOrders(pos);
      setDispatches(dis);
      setSiteReturns(sr);
      setTransfers(tr);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!focus) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocus(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  const whName = useMemo(() => new Map(warehouses.map((w) => [w.id, w.name])), [warehouses]);
  const siteName = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const supplierName = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const productName = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);

  // Per-product stock aggregation: total qty + non-zero location breakdown.
  const stockByProduct = useMemo(() => {
    const map = new Map<string, { totalQty: number; locations: string[] }>();
    for (const sl of stockLevels) {
      const entry = map.get(sl.product_id) ?? { totalQty: 0, locations: [] };
      entry.totalQty += sl.quantity;
      if (sl.quantity > 0) {
        const label = sl.location_type === "WAREHOUSE"
          ? (whName.get(sl.location_id) ?? sl.location_id)
          : (siteName.get(sl.location_id) ?? sl.location_id);
        entry.locations.push(`${label}: ${sl.quantity}`);
      }
      map.set(sl.product_id, entry);
    }
    return map;
  }, [stockLevels, whName, siteName]);

  const movements = useMemo<MovementRow[]>(() => {
    const rows: MovementRow[] = [];
    for (const po of purchaseOrders) {
      rows.push({
        id: po.id, type: "PO", reference: po.po_number, date: po.created_at,
        badgeVariant: badgeFor.PO,
        fromLabel: supplierName.get(po.supplier_id) ?? po.supplier_id,
        toLabel: whName.get(po.warehouse_id) ?? po.warehouse_id,
      });
    }
    for (const d of dispatches) {
      rows.push({
        id: d.id, type: "Dispatch", reference: d.dispatch_number, date: d.dispatched_at,
        badgeVariant: badgeFor.Dispatch,
        fromLabel: whName.get(d.from_warehouse_id) ?? d.from_warehouse_id,
        toLabel: siteName.get(d.to_site_id) ?? d.to_site_id,
      });
    }
    for (const sr of siteReturns) {
      rows.push({
        id: sr.id, type: "Return", reference: sr.return_number, date: sr.created_at,
        badgeVariant: badgeFor.Return,
        fromLabel: siteName.get(sr.from_site_id) ?? sr.from_site_id,
        toLabel: whName.get(sr.to_warehouse_id) ?? sr.to_warehouse_id,
      });
    }
    for (const t of transfers) {
      rows.push({
        id: t.id, type: "Transfer", reference: t.transfer_number, date: t.created_at,
        badgeVariant: badgeFor.Transfer,
        fromLabel: whName.get(t.from_warehouse_id) ?? t.from_warehouse_id,
        toLabel: whName.get(t.to_warehouse_id) ?? t.to_warehouse_id,
      });
    }
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows.slice(0, 15);
  }, [purchaseOrders, dispatches, siteReturns, transfers, supplierName, whName, siteName]);

  // Loads per-movement product line items (lazily, when focus mode is first opened).
  async function loadMovementDetails(): Promise<Record<string, MovementDetail | null>> {
    try {
      setDetailsLoading(true);
      const next: Record<string, MovementDetail | null> = {};
      await Promise.all(movements.map(async (m) => {
        try {
          const items =
            m.type === "PO" ? await fetchPOLineItems(m.id)
            : m.type === "Dispatch" ? await fetchDispatchLineItems(m.id)
            : m.type === "Return" ? await fetchSiteReturnLineItems(m.id)
            : await fetchTransferLineItems(m.id);
          const lines: DetailLine[] = items.map((li: { product_id: string; quantity?: number; qty_ordered?: number; qty_received?: number }) => ({
            name: productName.get(li.product_id) ?? li.product_id,
            qty: m.type === "PO" ? (li.qty_received || li.qty_ordered || 0) : (li.quantity ?? 0),
          }));
          next[m.id] = { lines, totalQty: lines.reduce((s, l) => s + l.qty, 0) };
        } catch {
          next[m.id] = null;
        }
      }));
      setMovementDetails(next);
      return next;
    } finally {
      setDetailsLoading(false);
    }
  }

  function openFocus(kind: "stock" | "movements") {
    setFocus(kind);
    if (kind === "movements" && Object.keys(movementDetails).length === 0) {
      loadMovementDetails();
    }
  }

  function exportStockCsv() {
    const headers = [
      "SKU", "Name", "Category", "Brand", "Model", "Size", "Color", "Unit",
      "Total Qty", "Stock Value (MMK)", "Reorder Point", "Last Cost (MMK)", "Locations",
    ];
    const rows = products.map((p) => {
      const agg = stockByProduct.get(p.id) ?? { totalQty: 0, locations: [] };
      return [
        p.sku, p.name, p.category || "", p.brand || "", p.model || "", p.size || "", p.color || "",
        p.unit, agg.totalQty, agg.totalQty * p.last_purchase_cost_mmk, p.reorder_point,
        p.last_purchase_cost_mmk, agg.locations.join("; "),
      ];
    });
    downloadCsv(`stock-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  async function exportMovementsCsv() {
    // Ensure product line details are available for the Products column.
    const detailSnapshot =
      Object.keys(movementDetails).length > 0 ? movementDetails : await loadMovementDetails();
    const headers = ["Type", "Reference", "Date", "From", "To", "Products", "Total Qty"];
    const rows = movements.map((m) => {
      const detail = detailSnapshot[m.id];
      const productsCell = detail
        ? detail.lines.map((l) => `${l.name} x${l.qty}`).join("; ")
        : "";
      return [
        m.type, m.reference, formatCsvDate(m.date), m.fromLabel, m.toLabel,
        productsCell, detail?.totalQty ?? "",
      ];
    });
    downloadCsv(`movements-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Reports" description="Stock reports, movement logs, and exports" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Reports" description="Stock reports, movement logs, and exports" />
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted">{loadError}</p>
          <Button onClick={loadData}>
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const summaryCards = [
    { label: "Total Products", value: products.length },
    { label: "Total Warehouses", value: warehouses.length },
    { label: "Total Sites", value: sites.length },
    { label: "Total POs", value: purchaseOrders.length },
    { label: "Total Dispatches", value: dispatches.length },
  ];

  const stockColumns = [
    { key: "sku", header: "SKU" },
    { key: "name", header: "Name" },
    { key: "category", header: "Category", render: (p: Product) => p.category || "-" },
    ...(focus === "stock" ? [
      { key: "brand", header: "Brand", render: (p: Product) => p.brand || "-" },
      { key: "model", header: "Model", render: (p: Product) => p.model || "-" },
      { key: "size", header: "Size", render: (p: Product) => p.size || "-" },
      { key: "color", header: "Color", render: (p: Product) => p.color || "-" },
    ] : []),
    { key: "unit", header: "Unit" },
    {
      key: "totalQty",
      header: "Total Qty",
      render: (p: Product) => (stockByProduct.get(p.id)?.totalQty ?? 0).toLocaleString(),
    },
    {
      key: "stockValue",
      header: "Stock Value",
      render: (p: Product) =>
        formatMmk((stockByProduct.get(p.id)?.totalQty ?? 0) * p.last_purchase_cost_mmk),
    },
    ...(focus === "stock" ? [
      { key: "reorder", header: "Reorder Pt", render: (p: Product) => p.reorder_point },
      {
        key: "locations",
        header: "Locations",
        render: (p: Product) => {
          const locs = stockByProduct.get(p.id)?.locations ?? [];
          return locs.length ? locs.join(", ") : "No stock";
        },
      },
    ] : []),
    { key: "lastCost", header: "Last Cost (MMK)", render: (p: Product) => formatMmk(p.last_purchase_cost_mmk) },
  ];

  function routeCell(m: MovementRow) {
    return (
      <span className="text-sm">
        <span className="text-foreground">{m.fromLabel}</span>
        <span className="text-muted mx-1">→</span>
        <span className="text-foreground">{m.toLabel}</span>
      </span>
    );
  }

  function productsCell(m: MovementRow) {
    if (detailsLoading && movementDetails[m.id] === undefined) {
      return <span className="text-muted text-xs">Loading…</span>;
    }
    const detail = movementDetails[m.id];
    if (!detail) return <span className="text-muted">-</span>;
    if (detail.lines.length === 0) return <span className="text-muted">No line items</span>;
    return (
      <ul className="space-y-0.5">
        {detail.lines.map((l, i) => (
          <li key={i} className="text-sm">
            {l.name} <span className="text-muted">x{l.qty}</span>
          </li>
        ))}
      </ul>
    );
  }

  const movementColumns = [
    { key: "type", header: "Type", render: (m: MovementRow) => <Badge variant={m.badgeVariant}>{m.type}</Badge> },
    { key: "reference", header: "Reference" },
    { key: "date", header: "Date", render: (m: MovementRow) => formatDate(m.date) },
    ...(focus === "movements" ? [
      { key: "from", header: "From", render: (m: MovementRow) => m.fromLabel },
      { key: "to", header: "To", render: (m: MovementRow) => m.toLabel },
      { key: "products", header: "Products", render: productsCell },
      {
        key: "totalQty",
        header: "Total Qty",
        render: (m: MovementRow) => {
          const d = movementDetails[m.id];
          return d ? <span className="font-medium">{d.totalQty.toLocaleString()}</span> : "-";
        },
      },
    ] : [
      { key: "route", header: "Route", render: routeCell },
    ]),
  ];

  const StockCard = (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>Stock Report</CardTitle>
        <div className="flex items-center gap-1">
          <FocusButton active={focus === "stock"} onClick={() => (focus === "stock" ? setFocus(null) : openFocus("stock"))} />
          <div className="flex gap-2 no-print">
            <Button variant="secondary" size="sm" onClick={exportStockCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </Button>
          </div>
        </div>
      </div>
      <CardContent>
        <Table columns={stockColumns} data={products} emptyMessage="No products" />
      </CardContent>
    </Card>
  );

  const MovementsCard = (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>Movement Log</CardTitle>
        <div className="flex items-center gap-1">
          <FocusButton active={focus === "movements"} onClick={() => (focus === "movements" ? setFocus(null) : openFocus("movements"))} />
          <div className="flex gap-2 no-print">
            <Button variant="secondary" size="sm" onClick={exportMovementsCsv}>
              <Download size={14} /> Export CSV
            </Button>
          </div>
        </div>
      </div>
      <CardContent>
        <Table columns={movementColumns} data={movements} emptyMessage="No movements" />
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Stock reports, movement logs, and exports"
        actions={
          focus ? (
            <Button variant="secondary" size="sm" onClick={() => setFocus(null)}>
              <Minimize2 size={14} /> Exit focus
            </Button>
          ) : undefined
        }
      />

      {!focus && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 print:grid-cols-5">
          {summaryCards.map((sc) => (
            <Card key={sc.label}>
              <CardContent>
                <p className="text-xs text-muted">{sc.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{sc.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className={focus ? "grid grid-cols-1" : "grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1"}>
        {focus !== "movements" && StockCard}
        {focus !== "stock" && MovementsCard}
      </div>
    </div>
  );
}
