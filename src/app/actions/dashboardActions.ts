"use server";

import { getCurrentOrgId, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeValuation, type Valuation } from "@/lib/valuation";
import { canAccessLocation } from "@/lib/locationAccess";

export interface DashboardActivityItem {
  id: string;
  type: "PO_RECEIVED" | "DISPATCH" | "SITE_RETURN" | "TRANSFER" | "WRITE_OFF";
  label: string;
  ref: string;
  location: string;
  qty: number;
  at: string;
}

export interface DashboardLocationValue {
  id: string;
  name: string;
  type: "WAREHOUSE" | "SITE";
  value: number;
  qty: number;
  items: number;
}

export interface DashboardStats {
  totalProducts: number;
  totalWarehouses: number;
  totalSites: number;
  pendingPOs: number;
  activeDispatches: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValue: number;
  totalStockQty: number;
  totalValue: number;
}

interface StockRow {
  product_id: string;
  location_type: "WAREHOUSE" | "SITE";
  location_id: string;
  quantity: number;
  status: string;
}

interface TransferRow {
  id: string;
  transfer_number: string;
  status: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  created_at: string;
}

interface WriteOffRow {
  id: string;
  product_id: string;
  location_type: "WAREHOUSE" | "SITE";
  location_id: string;
  quantity: number;
  reason: string;
  created_at: string;
}

export async function fetchDashboardData(): Promise<{
  stats: DashboardStats;
  activity: DashboardActivityItem[];
  locations: DashboardLocationValue[];
  orgName: string;
  valuation: Valuation;
}> {
  const [orgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const supabase = await createClient();

  const [
    productsRes,
    warehousesRes,
    sitesRes,
    posRes,
    dispatchesRes,
    returnsRes,
    transfersRes,
    writeOffsRes,
    stockRes,
    orgRes,
  ] = await Promise.all([
    supabase.from("products").select("id, name, base_cost_mmk, last_purchase_cost_mmk").eq("org_id", orgId),
    supabase.from("warehouses").select("id, name").eq("org_id", orgId),
    supabase.from("sites").select("id, name").eq("org_id", orgId),
    supabase.from("purchase_orders").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
    supabase.from("dispatches").select("*").eq("org_id", orgId).order("dispatched_at", { ascending: false }).limit(5),
    supabase.from("site_returns").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
    supabase.from("stock_transfers").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
    supabase.from("write_offs").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
    supabase.from("stock_levels").select("product_id, location_type, location_id, quantity, status").eq("org_id", orgId),
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
  ]);

  // Full counts for KPIs — the activity fetches above are limit(5) snapshots.
  const [poCountRes, dispatchCountRes] = await Promise.all([
    supabase.from("purchase_orders").select("id, status, warehouse_id").eq("org_id", orgId),
    supabase.from("dispatches").select("id, status, from_warehouse_id, to_site_id").eq("org_id", orgId),
  ]);

  // Full data sets for the valuation engine (unaffected by activity limits).
  const visiblePOs = (poCountRes.data ?? []).filter((po) =>
    canAccessLocation(user, "WAREHOUSE", po.warehouse_id)
  );
  const allPOIds = visiblePOs.map((p) => p.id);
  const [poLinesRes, supplierReturnsRes, allWriteOffsRes, priceHistoryRes] = await Promise.all([
    allPOIds.length > 0
      ? supabase.from("po_line_items").select("product_id, qty_received, unit_cost_mmk").in("po_id", allPOIds)
      : Promise.resolve({ data: [] as { product_id: string; qty_received: number; unit_cost_mmk: number }[] }),
    supabase.from("supplier_returns").select("warehouse_id, items").eq("org_id", orgId),
    supabase.from("write_offs").select("product_id, location_type, location_id, quantity, reason, created_at").eq("org_id", orgId),
    supabase.from("price_history").select("product_id, cost_mmk, recorded_at").eq("org_id", orgId),
  ]);

  const products = productsRes.data ?? [];
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const warehouses = (warehousesRes.data ?? []).filter((warehouse) =>
    canAccessLocation(user, "WAREHOUSE", warehouse.id)
  );
  const sites = (sitesRes.data ?? []).filter((site) =>
    canAccessLocation(user, "SITE", site.id)
  );
  const pos = (posRes.data ?? []).filter((po) =>
    canAccessLocation(user, "WAREHOUSE", po.warehouse_id)
  );
  const dispatches = (dispatchesRes.data ?? []).filter((dispatch) =>
    canAccessLocation(user, "WAREHOUSE", dispatch.from_warehouse_id) &&
    canAccessLocation(user, "SITE", dispatch.to_site_id)
  );
  const returns = (returnsRes.data ?? []).filter((record) =>
    canAccessLocation(user, "SITE", record.from_site_id) &&
    canAccessLocation(user, "WAREHOUSE", record.to_warehouse_id)
  );
  const transfers = ((transfersRes.data ?? []) as TransferRow[]).filter((record) =>
    canAccessLocation(user, "WAREHOUSE", record.from_warehouse_id) &&
    canAccessLocation(user, "WAREHOUSE", record.to_warehouse_id)
  );
  const writeOffs = ((writeOffsRes.data ?? []) as WriteOffRow[]).filter((record) =>
    canAccessLocation(user, record.location_type, record.location_id)
  );
  const stock = ((stockRes.data ?? []) as StockRow[]).filter((row) =>
    canAccessLocation(user, row.location_type, row.location_id)
  );

  const allPOs = visiblePOs;
  const allDispatches = (dispatchCountRes.data ?? []).filter((dispatch) =>
    canAccessLocation(user, "WAREHOUSE", dispatch.from_warehouse_id) &&
    canAccessLocation(user, "SITE", dispatch.to_site_id)
  );
  const pendingPOs = allPOs.filter(
    (p) => p.status === "PENDING" || p.status === "PARTIAL"
  ).length;
  const activeDispatches = allDispatches.filter(
    (d) => d.status === "DISPATCHED"
  ).length;

  const lowStockCount = stock.filter((s) => s.status === "LOW_STOCK").length;
  const outOfStockCount = stock.filter((s) => s.status === "OUT_OF_STOCK").length;
  const totalStockQty = stock.reduce((sum, s) => sum + Number(s.quantity || 0), 0);

  // Valuation: stock × product cost (skip orphans — product may be deleted)
  const costMap = new Map<string, number>();
  for (const p of products) {
    costMap.set(p.id, Number(p.last_purchase_cost_mmk || 0));
  }
  const rowValue = (s: StockRow) =>
    Number(s.quantity || 0) * (costMap.get(s.product_id) ?? 0);

  // Three-part stock valuation: cost basis (money spent, net of supplier
  // refunds) / growth (current value vs basis, 6-month trend) / depreciation
  // (write-off losses over time).
  const knownProducts = new Set(products.map((p) => p.id));
  const supplierReturnItems = (supplierReturnsRes.data ?? [])
    .filter((record) => canAccessLocation(user, "WAREHOUSE", record.warehouse_id))
    .flatMap(
    (r) => (r.items ?? []) as { product_id: string; quantity: number; unit_cost_mmk: number }[]
  );
  const valuation = computeValuation({
    products: products.map((p) => ({
      id: p.id,
      base_cost_mmk: Number(p.base_cost_mmk || 0),
      last_purchase_cost_mmk: Number(p.last_purchase_cost_mmk || 0),
    })),
    stock: stock
      .filter((s) => s.product_id && knownProducts.has(s.product_id))
      .map((s) => ({ product_id: s.product_id, quantity: Number(s.quantity || 0) })),
    receivedLines: (poLinesRes.data ?? []) as {
      product_id: string;
      qty_received: number;
      unit_cost_mmk: number;
    }[],
    supplierReturnItems,
    writeOffs: ((allWriteOffsRes.data ?? []) as Array<{
      product_id: string;
      location_type: "WAREHOUSE" | "SITE";
      location_id: string;
      quantity: number;
      reason: string;
      created_at: string;
    }>)
      .filter((record) => canAccessLocation(user, record.location_type, record.location_id))
      .map(({ product_id, quantity, reason, created_at }) => ({
        product_id,
        quantity,
        reason,
        created_at,
      })),
    priceHistory: (priceHistoryRes.data ?? []) as {
      product_id: string;
      cost_mmk: number;
      recorded_at: string;
    }[],
  });
  const totalStockValue = valuation.currentValue;

  // Location values
  const locNames = new Map<string, string>();
  for (const w of warehouses) locNames.set(w.id, w.name);
  for (const s of sites) locNames.set(s.id, s.name);

  const locMap = new Map<string, DashboardLocationValue>();
  for (const row of stock) {
    if (!row.location_id || !row.location_type) continue;
    // Skip orphans (location deleted) — never surface "Unknown" entries.
    if (!locNames.has(row.location_id)) continue;
    const key = `${row.location_type}:${row.location_id}`;
    const existing = locMap.get(key);
    const qty = Number(row.quantity || 0);
    if (existing) {
      existing.qty += qty;
      existing.items += 1;
      existing.value += rowValue(row);
    } else {
      locMap.set(key, {
        id: row.location_id,
        name: locNames.get(row.location_id)!,
        type: row.location_type,
        value: rowValue(row),
        qty,
        items: 1,
      });
    }
  }

  const locations = [...locMap.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Activity feed
  const activity: DashboardActivityItem[] = [];

  for (const d of dispatches) {
    activity.push({
      id: `d-${d.id}`,
      type: "DISPATCH",
      label: `${d.receiver_name || "Receiver"} received goods`,
      ref: d.dispatch_number,
      location: locNames.get(d.to_site_id) ?? "Site",
      qty: 0,
      at: d.dispatched_at,
    });
  }

  for (const po of pos) {
    if (po.status !== "DRAFT") {
      activity.push({
        id: `po-${po.id}`,
        type: "PO_RECEIVED",
        label: `PO ${po.po_number} — ${po.status.toLowerCase()}`,
        ref: po.po_number,
        location: locNames.get(po.warehouse_id) ?? "Warehouse",
        qty: 0,
        at: po.updated_at ?? po.created_at,
      });
    }
  }

  for (const r of returns) {
    activity.push({
      id: `r-${r.id}`,
      type: "SITE_RETURN",
      label: `Return received from ${locNames.get(r.from_site_id) || "site"}`,
      ref: r.return_number,
      location: locNames.get(r.to_warehouse_id) ?? "Warehouse",
      qty: 0,
      at: r.created_at,
    });
  }

  for (const t of transfers) {
    activity.push({
      id: `t-${t.id}`,
      type: "TRANSFER",
      label: `Transfer ${t.status.toLowerCase()}`,
      ref: t.transfer_number,
      location: `${locNames.get(t.from_warehouse_id) ?? "Warehouse"} → ${
        locNames.get(t.to_warehouse_id) ?? "Warehouse"
      }`,
      qty: 0,
      at: t.created_at,
    });
  }

  for (const w of writeOffs) {
    activity.push({
      id: `w-${w.id}`,
      type: "WRITE_OFF",
      label: `${w.quantity} × ${productNames.get(w.product_id) ?? "item"} written off (${w.reason.toLowerCase()})`,
      ref: `WO-${w.id}`,
      location: locNames.get(w.location_id) ?? (w.location_type === "SITE" ? "Site" : "Warehouse"),
      qty: w.quantity,
      at: w.created_at,
    });
  }

  activity.sort((a, b) => b.at.localeCompare(a.at));
  const uniqueActivity = Array.from(
    new Map(activity.map((a) => [a.ref, a])).values()
  ).slice(0, 8);

  return {
    stats: {
      totalProducts: products.length,
      totalWarehouses: warehouses.length,
      totalSites: sites.length,
      pendingPOs,
      activeDispatches,
      lowStockCount,
      outOfStockCount,
      totalStockValue,
      totalStockQty,
      totalValue: totalStockValue,
    },
    activity: uniqueActivity,
    locations,
    orgName: orgRes.data?.name ?? "My Company",
    valuation,
  };
}