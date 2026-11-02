"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Warehouse,
  MapPin,
  ShoppingCart,
  Truck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Building2,
  Receipt,
  Wallet,
} from "lucide-react";
import Card, { CardContent, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import {
  fetchDashboardData,
  type DashboardActivityItem,
  type DashboardLocationValue,
  type DashboardStats,
} from "@/app/actions/dashboardActions";
import type { Valuation } from "@/lib/valuation";
import { formatMmk } from "@/lib/money";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [locations, setLocations] = useState<DashboardLocationValue[]>([]);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDashboardData();
      setStats(data.stats);
      setActivity(data.activity);
      setLocations(data.locations);
      setValuation(data.valuation);
      setOrgName(data.orgName);
    } catch (e) {
      console.error(e);
      setError("Could not load dashboard data. Check your connection to Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner />;

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertTriangle size={40} className="text-warning mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Dashboard unavailable</h2>
        <p className="text-sm text-muted mt-1 mb-6 max-w-sm text-center">{error || "No data found."}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={14} className="inline mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const kpis = [
    { label: "Total Products", value: stats.totalProducts, icon: Package, color: "text-primary", href: "/products" },
    { label: "Warehouses", value: stats.totalWarehouses, icon: Warehouse, color: "text-success", href: "/warehouses" },
    { label: "Sites", value: stats.totalSites, icon: MapPin, color: "text-accent", href: "/sites" },
    { label: "Pending POs", value: stats.pendingPOs, icon: ShoppingCart, color: "text-warning", href: "/purchase-orders" },
    { label: "Active Dispatches", value: stats.activeDispatches, icon: Truck, color: "text-info", href: "/dispatches" },
    { label: "Low Stock Items", value: stats.lowStockCount, icon: AlertTriangle, color: "text-danger", href: "/alerts" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted mt-1 flex items-center gap-2">
            <Building2 size={14} className="text-muted" />
            {orgName} — Overview of your warehouse operations
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-border hover:bg-card-hover text-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            onClick={() => router.push(kpi.href)}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
          >
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{kpi.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-card-hover flex items-center justify-center">
                  <kpi.icon size={24} className={kpi.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm text-muted">MVP status</p>
                <h2 className="text-xl font-semibold text-foreground">Operational warehouse core is active</h2>
              </div>
              <Badge variant="success">Ready for rollout</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: "Inventory", value: "Products + stock tracking", ready: true },
                { label: "Locations", value: "Warehouses + sites", ready: true },
                { label: "Orders", value: "POs + receiving + dispatch", ready: true },
                { label: "Controls", value: "Alerts + reports + exports", ready: true },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-card-hover/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted">{item.label}</p>
                    <span className={`h-2.5 w-2.5 rounded-full ${item.ready ? "bg-success" : "bg-warning"}`} />
                  </div>
                  <p className="mt-2 text-sm text-foreground font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock valuation: cost basis / growth / depreciation */}
      {valuation && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Stock Valuation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted">Cost Basis — money spent</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{formatMmk(valuation.costBasis)}</p>
                    <p className="text-xs text-muted mt-1">
                      Net of supplier refunds · avg paid × {valuation.totalQty.toLocaleString()} units on hand
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-card-hover flex items-center justify-center">
                    <Wallet size={24} className="text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted">Growth — value vs cost</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-2xl font-bold ${valuation.growth >= 0 ? "text-success" : "text-danger"}`}>
                        {valuation.growth >= 0 ? "+" : ""}{formatMmk(valuation.growth)}
                      </p>
                      {valuation.growthPct !== null && (
                        <Badge variant={valuation.growth >= 0 ? "success" : "danger"}>
                          {valuation.growth >= 0 ? (
                            <TrendingUp size={12} className="mr-1" />
                          ) : (
                            <TrendingDown size={12} className="mr-1" />
                          )}
                          {valuation.growth >= 0 ? "+" : ""}{valuation.growthPct.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Current value {formatMmk(valuation.currentValue)} vs basis {formatMmk(valuation.costBasis)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-card-hover flex items-center justify-center">
                    {valuation.growth >= 0 ? (
                      <TrendingUp size={24} className="text-success" />
                    ) : (
                      <TrendingDown size={24} className="text-danger" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted">Depreciation — losses</p>
                    <p className="text-2xl font-bold text-danger mt-1">{formatMmk(valuation.depreciationTotal)}</p>
                    <p className="text-xs text-muted mt-1">
                      Written off (damaged, lost, expired) · {formatMmk(valuation.depreciationThisMonth)} this month
                    </p>
                    {Object.keys(valuation.depreciationByReason).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(valuation.depreciationByReason)
                          .filter(([, v]) => v > 0)
                          .sort((a, b) => b[1] - a[1])
                          .map(([reason, value]) => (
                            <Badge key={reason} variant="danger">{reason.toLowerCase()} {formatMmk(value)}</Badge>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-card-hover flex items-center justify-center">
                    <TrendingDown size={24} className="text-danger" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Valuation trend + top locations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardTitle>Valuation Over Time (6 months)</CardTitle>
          {valuation ? (
            <CardContent className="mt-4 space-y-6">
              <div>
                <p className="text-xs text-muted mb-1">
                  Stock value at current quantities × historical prices vs cost basis
                </p>
                <MonthlyBars
                  data={valuation.monthly.map((m) => ({ label: m.label, value: m.stockValue }))}
                  colorClass="text-primary"
                  reference={valuation.costBasis}
                />
                <p className="text-xs text-muted mt-1">
                  <span className="inline-block h-2 w-3 rounded-sm bg-primary align-middle mr-1" />
                  Stock value
                  <span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted align-middle mx-2" />
                  Cost basis {formatMmk(valuation.costBasis)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Depreciation written off per month</p>
                <MonthlyBars
                  data={valuation.monthly.map((m) => ({ label: m.label, value: m.depreciation }))}
                  colorClass="text-danger"
                />
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-sm text-muted text-center py-8">No valuation data available.</p>
            </CardContent>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <CardTitle>Top Locations by Value</CardTitle>
          <div className="mt-4 space-y-3">
            {locations.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">
                No stock data available. Receive goods via purchase orders to see location values.
              </p>
            ) : (
              locations.map((loc) => (
                <button
                  key={`${loc.type}-${loc.id}`}
                  onClick={() => router.push(`/${loc.type === "WAREHOUSE" ? "warehouses" : "sites"}/${loc.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-card-hover transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {loc.name}{" "}
                      <Badge variant={loc.type === "WAREHOUSE" ? "success" : "info"}>
                        {loc.type === "WAREHOUSE" ? "WH" : "Site"}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {loc.items} items · {loc.qty.toLocaleString()} units
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{formatMmk(loc.value)}</p>
                    <ArrowRight size={14} className="text-muted" />
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardTitle>Recent Activity</CardTitle>
        <div className="mt-4 space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No recent activity yet. Start by adding products and creating purchase orders.
            </p>
          ) : (
            activity.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-card-hover transition-colors"
              >
                <ActivityIcon type={a.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.label}</p>
                  <p className="text-xs text-muted">
                    {a.ref} · {a.location} · {formatDate(a.at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function MonthlyBars({
  data,
  colorClass,
  reference,
}: {
  data: { label: string; value: number }[];
  colorClass: string;
  reference?: number;
}) {
  const W = 640;
  const H = 170;
  const padX = 32;
  const baseY = H - 26;
  const topY = 16;
  const gap = 14;
  const barW = (W - padX * 2 - gap * (data.length - 1)) / data.length;
  const max = Math.max(...data.map((d) => d.value), reference ?? 0, 1);
  const y = (v: number) => baseY - (v / max) * (baseY - topY);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-muted" role="img" aria-label="Monthly valuation chart">
      <line x1={padX} x2={W - padX} y1={baseY} y2={baseY} stroke="currentColor" strokeWidth={1} opacity={0.4} />
      {reference !== undefined && reference > 0 && (
        <line
          x1={padX}
          x2={W - padX}
          y1={y(reference)}
          y2={y(reference)}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.7}
        />
      )}
      {data.map((d, i) => {
        const x = padX + i * (barW + gap);
        const barY = y(d.value);
        const h = Math.max(baseY - barY, d.value > 0 ? 2 : 0);
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={baseY - h} width={barW} height={h} rx={4} className={colorClass} fill="currentColor">
              <title>{`${d.label}: ${formatMmk(d.value)}`}</title>
            </rect>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.8}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ActivityIcon({ type }: { type: DashboardActivityItem["type"] }) {
  const map: Record<DashboardActivityItem["type"], { icon: typeof Package; cls: string }> = {
    PO_RECEIVED: { icon: Receipt, cls: "text-success" },
    DISPATCH: { icon: Truck, cls: "text-info" },
    SITE_RETURN: { icon: ArrowLeft, cls: "text-accent" },
    TRANSFER: { icon: RefreshCw, cls: "text-primary" },
    WRITE_OFF: { icon: AlertTriangle, cls: "text-danger" },
  };
  const { icon: Icon, cls } = map[type];
  return (
    <div className="h-9 w-9 rounded-lg bg-card-hover flex items-center justify-center shrink-0">
      <Icon size={16} className={cls} />
    </div>
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