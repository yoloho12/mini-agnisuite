/**
 * Helpers for numeric text inputs (NumericInput). Leading zeros are legal
 * while the user is typing — parsing only happens when a number is needed.
 */

/** Keeps only digits (and optionally a single decimal point). Leading zeros are preserved. */
export function sanitizeNumericInput(raw: string, allowDecimal: boolean): string {
  let cleaned = raw.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (allowDecimal) {
    const dot = cleaned.indexOf(".");
    if (dot !== -1) {
      cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
    }
  }
  return cleaned;
}

/** Parses a sanitized numeric draft ("007" -> 7, "0." -> 0, "" -> 0). */
export function parseNumericInput(cleaned: string): number {
  if (cleaned === "" || cleaned === ".") return 0;
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

/** Clamps a number to optional string/number bounds (used on blur). */
export function clampNumber(
  value: number,
  min: string | number | undefined,
  max: string | number | undefined
): number {
  const minNum = min === undefined || min === "" ? null : Number(min);
  const maxNum = max === undefined || max === "" ? null : Number(max);
  let out = value;
  if (minNum !== null && !Number.isNaN(minNum) && out < minNum) out = minNum;
  if (maxNum !== null && !Number.isNaN(maxNum) && out > maxNum) out = maxNum;
  return out;
}
