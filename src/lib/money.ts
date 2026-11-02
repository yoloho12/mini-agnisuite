export function mmkToDisplay(cents: number): string {
  return formatAmount(cents);
}

export function parseMmkInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Parses a formatted amount input ("1,234.567") into a number.
 * Keeps decimals (no rounding) — unlike parseMmkInput.
 */
export function parseAmountInput(value: string): number {
  const cleaned = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function calculateTotal(items: { unit_cost_mmk: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.unit_cost_mmk * item.quantity, 0);
}

export function convertUsdToMmk(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * 100 * rate);
}

/** Comma-grouped amount, trailing zeros stripped: 1234.5 -> "1,234.5", 1234 -> "1,234". */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatMmk(amount: number): string {
  return `${formatAmount(amount)} MMK`;
}
