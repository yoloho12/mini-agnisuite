import type { BarcodeFormat } from "@/types";

/**
 * Products without a barcode get a generated EAN-13 value. GS1 reserves the
 * 200-299 prefix range for internal / restricted-distribution numbering, which
 * makes it safe for locally generated product codes.
 */
const INTERNAL_EAN_PREFIX = "200";

export const DEFAULT_BARCODE_FORMAT: BarcodeFormat = "EAN13";

function randomDigits(length: number): string {
  const digits: string[] = [];
  const cryptoObject = globalThis.crypto;

  if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
    const bytes = new Uint8Array(length);
    cryptoObject.getRandomValues(bytes);
    for (const byte of bytes) digits.push(String(byte % 10));
  } else {
    for (let i = 0; i < length; i += 1) {
      digits.push(String(Math.floor(Math.random() * 10)));
    }
  }

  return digits.join("");
}

/** Calculates the EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(base12: string): number {
  if (!/^\d{12}$/.test(base12)) {
    throw new Error("EAN-13 base value must contain exactly 12 digits");
  }

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^\d{13}$/.test(trimmed) &&
    Number(trimmed[12]) === ean13CheckDigit(trimmed.slice(0, 12))
  );
}

/** Generates a check-digit-correct internal-use EAN-13 value. */
export function generateEan13(): string {
  const base = `${INTERNAL_EAN_PREFIX}${randomDigits(9)}`;
  return `${base}${ean13CheckDigit(base)}`;
}

/**
 * Generates a barcode value that is not present in `used`. The generated value
 * is always a valid EAN-13 number so the same value can be printed as an
 * EAN-13 barcode or as a QR code.
 */
export function generateBarcodeValue(used: ReadonlySet<string> = new Set<string>()): string {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = generateEan13();
    if (!used.has(candidate)) return candidate;
  }
  return generateEan13();
}

/** Picks a sensible stored format for a user-supplied barcode value. */
export function detectBarcodeFormat(value: string): BarcodeFormat {
  return isValidEan13(value) ? "EAN13" : "CODE128";
}

/**
 * Parses a format cell from the import file. Returns null for blank or
 * unrecognised values; callers should distinguish the two via the raw value.
 */
export function parseBarcodeFormat(raw: string): BarcodeFormat | null {
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) return null;
  if (normalized === "CODE128" || normalized === "CODE") return "CODE128";
  if (normalized === "EAN13" || normalized === "EAN") return "EAN13";
  if (normalized === "QR" || normalized === "QRCODE") return "QR";
  return null;
}

/** bwip-js symbology id for a stored product format. */
export function bcidForFormat(
  format: BarcodeFormat | null | undefined
): "code128" | "ean13" | "qrcode" {
  switch (format) {
    case "EAN13":
      return "ean13";
    case "QR":
      return "qrcode";
    default:
      return "code128";
  }
}
