import type { LocationType, StockLevel } from "@/types";

/**
 * The product Quick Actions (and the scanner's "Create PO") navigate with
 * `?product=<id>`. Read it client-side via window.location so no form needs
 * useSearchParams (and therefore no Suspense boundary / static-render change).
 * Returns null when the param is absent, blank, or on the server.
 */
export function getProductIdParam(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("product");
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Stock row with the most quantity at one location type — ties go to the first row. */
export function bestLocation(rows: StockLevel[], type: LocationType): StockLevel | null {
  let best: StockLevel | null = null;
  for (const row of rows) {
    if (row.location_type !== type) continue;
    if (!best || row.quantity > best.quantity) best = row;
  }
  return best;
}

/** Stock row with the most quantity across all locations (any type). */
export function bestStockLocation(rows: StockLevel[]): StockLevel | null {
  let best: StockLevel | null = null;
  for (const row of rows) {
    if (!best || row.quantity > best.quantity) best = row;
  }
  return best;
}

/** Quantity of a product at a specific location — 0 when no row exists. */
export function qtyAt(rows: StockLevel[], type: LocationType, locationId: string): number {
  return rows.find((r) => r.location_type === type && r.location_id === locationId)?.quantity ?? 0;
}
