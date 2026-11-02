// Stock valuation engine.
//
// Three distinct parts of stock value:
// 1. Cost basis  — the actual money spent on the goods we still hold:
//    (received PO value − supplier-return refunds) averaged over the units
//    that remain ours, multiplied by units on hand. Supplier refunds reduce
//    the basis both by shrinking stock and by netting out the refunded cost.
// 2. Growth      — current valuation (units × current value price) minus the
//    cost basis, plus a 6-month trend reconstructed from price history at
//    current quantities.
// 3. Depreciation — value destroyed by write-offs (damaged / lost / expired /
//    other), valued at the product price in effect when the write-off
//    happened, broken down by reason and by month.

export interface ValuationProductInput {
  id: string;
  base_cost_mmk: number;
  last_purchase_cost_mmk: number;
}

export interface ValuationStockRow {
  product_id: string;
  quantity: number;
}

export interface ValuationReceivedLine {
  product_id: string;
  qty_received: number;
  unit_cost_mmk: number;
}

export interface ValuationSupplierReturnItem {
  product_id: string;
  quantity: number;
  unit_cost_mmk: number;
}

export interface ValuationWriteOff {
  product_id: string;
  quantity: number;
  reason: string;
  created_at: string;
}

export interface ValuationPricePoint {
  product_id: string;
  cost_mmk: number;
  recorded_at: string;
}

export interface ValuationInput {
  products: ValuationProductInput[];
  stock: ValuationStockRow[];
  receivedLines: ValuationReceivedLine[];
  supplierReturnItems: ValuationSupplierReturnItem[];
  writeOffs: ValuationWriteOff[];
  priceHistory: ValuationPricePoint[];
}

export interface ProductValuation {
  product_id: string;
  quantity: number;
  basisPerUnit: number;
  valuePerUnit: number;
  costBasis: number;
  currentValue: number;
  growth: number;
}

export interface MonthlyValuationPoint {
  month: string; // "YYYY-MM"
  label: string; // "May"
  stockValue: number;
  costBasis: number;
  growth: number;
  depreciation: number;
}

export interface Valuation {
  costBasis: number;
  currentValue: number;
  growth: number;
  growthPct: number | null;
  totalQty: number;
  depreciationTotal: number;
  depreciationThisMonth: number;
  depreciationByReason: Record<string, number>;
  monthly: MonthlyValuationPoint[];
  byProduct: ProductValuation[];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(now: Date, n: number): Date[] {
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)); // month end
  }
  return out;
}

// Latest known price for a product at a point in time. Falls back to the
// earliest recorded price (before the first entry we know about), then the
// product's current value price, then its base cost.
function priceAt(
  historyByProduct: Map<string, ValuationPricePoint[]>,
  product: ValuationProductInput | undefined,
  ts: Date
): number {
  const entries = historyByProduct.get(product?.id ?? "");
  if (entries && entries.length > 0) {
    let latest: ValuationPricePoint | null = null;
    let earliest: ValuationPricePoint | null = null;
    for (const e of entries) {
      const t = new Date(e.recorded_at).getTime();
      if (t <= ts.getTime() && (!latest || t > new Date(latest.recorded_at).getTime())) {
        latest = e;
      }
      if (!earliest || t < new Date(earliest.recorded_at).getTime()) {
        earliest = e;
      }
    }
    const pick = latest ?? earliest;
    if (pick) return pick.cost_mmk;
  }
  if (product) {
    return product.last_purchase_cost_mmk > 0 ? product.last_purchase_cost_mmk : product.base_cost_mmk;
  }
  return 0;
}

export function computeValuation(input: ValuationInput, now: Date = new Date()): Valuation {
  const productsById = new Map(input.products.map((p) => [p.id, p]));

  const stockByProduct = new Map<string, number>();
  for (const row of input.stock) {
    if (!row.product_id) continue;
    stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) ?? 0) + Number(row.quantity || 0));
  }

  // Net purchase pools per product: what we received minus what we refunded
  // back to suppliers. Average paid price is computed over the units that
  // remain ours.
  const receivedQty = new Map<string, number>();
  const receivedCost = new Map<string, number>();
  for (const line of input.receivedLines) {
    const qty = Number(line.qty_received || 0);
    if (qty <= 0) continue;
    receivedQty.set(line.product_id, (receivedQty.get(line.product_id) ?? 0) + qty);
    receivedCost.set(
      line.product_id,
      (receivedCost.get(line.product_id) ?? 0) + qty * Number(line.unit_cost_mmk || 0)
    );
  }
  for (const item of input.supplierReturnItems) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;
    receivedQty.set(item.product_id, (receivedQty.get(item.product_id) ?? 0) - qty);
    receivedCost.set(
      item.product_id,
      (receivedCost.get(item.product_id) ?? 0) - qty * Number(item.unit_cost_mmk || 0)
    );
  }

  const basisPerUnit = new Map<string, number>();
  for (const p of input.products) {
    const q = receivedQty.get(p.id) ?? 0;
    const c = receivedCost.get(p.id) ?? 0;
    basisPerUnit.set(p.id, q > 0 && c > 0 ? c / q : p.base_cost_mmk);
  }

  const historyByProduct = new Map<string, ValuationPricePoint[]>();
  for (const point of input.priceHistory) {
    const list = historyByProduct.get(point.product_id);
    if (list) list.push(point);
    else historyByProduct.set(point.product_id, [point]);
  }

  // Per-product valuation (only products actually on hand).
  const byProduct: ProductValuation[] = [];
  let costBasis = 0;
  let currentValue = 0;
  let totalQty = 0;
  for (const [productId, qty] of stockByProduct) {
    if (qty <= 0) continue;
    const product = productsById.get(productId);
    const basis = basisPerUnit.get(productId) ?? product?.base_cost_mmk ?? 0;
    const value =
      product && product.last_purchase_cost_mmk > 0
        ? product.last_purchase_cost_mmk
        : product?.base_cost_mmk ?? 0;
    const rowBasis = Math.round(qty * basis);
    const rowValue = Math.round(qty * value);
    costBasis += rowBasis;
    currentValue += rowValue;
    totalQty += qty;
    byProduct.push({
      product_id: productId,
      quantity: qty,
      basisPerUnit: Math.round(basis),
      valuePerUnit: Math.round(value),
      costBasis: rowBasis,
      currentValue: rowValue,
      growth: rowValue - rowBasis,
    });
  }
  byProduct.sort((a, b) => b.growth - a.growth);

  // Depreciation: value destroyed by write-offs, priced at the product cost
  // in effect when each write-off happened.
  const writeOffValue = (w: ValuationWriteOff): number => {
    const product = productsById.get(w.product_id);
    const price = priceAt(historyByProduct, product, new Date(w.created_at)) || basisPerUnit.get(w.product_id) || 0;
    return Math.round(Number(w.quantity || 0) * price);
  };

  let depreciationTotal = 0;
  const depreciationByReason: Record<string, number> = {};
  const depreciationByMonth = new Map<string, number>();
  const thisMonth = monthKey(now);
  let depreciationThisMonth = 0;
  for (const w of input.writeOffs) {
    const value = writeOffValue(w);
    depreciationTotal += value;
    depreciationByReason[w.reason] = (depreciationByReason[w.reason] ?? 0) + value;
    const key = monthKey(new Date(w.created_at));
    depreciationByMonth.set(key, (depreciationByMonth.get(key) ?? 0) + value);
    if (key === thisMonth) depreciationThisMonth += value;
  }

  // 6-month trend: current quantities revalued at each month-end price.
  const monthly: MonthlyValuationPoint[] = lastNMonths(now, 6).map((monthEnd) => {
    let stockValue = 0;
    for (const [productId, qty] of stockByProduct) {
      if (qty <= 0) continue;
      stockValue += Math.round(qty * priceAt(historyByProduct, productsById.get(productId), monthEnd));
    }
    const key = monthKey(monthEnd);
    const depreciation = depreciationByMonth.get(key) ?? 0;
    return {
      month: key,
      label: MONTH_NAMES[monthEnd.getMonth()],
      stockValue,
      costBasis,
      growth: stockValue - costBasis,
      depreciation,
    };
  });

  return {
    costBasis,
    currentValue,
    growth: currentValue - costBasis,
    growthPct: costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : null,
    totalQty,
    depreciationTotal,
    depreciationThisMonth,
    depreciationByReason,
    monthly,
    byProduct,
  };
}
