import * as XLSX from "xlsx";

/**
 * Downloads rows as a real .xlsx workbook (SheetJS). `rows` are plain
 * cell values; the first row is typically the header.
 */
export interface ExcelSheet {
  name: string;
  rows: (string | number | null)[][];
  colWidths?: { wch: number }[];
}

/**
 * Downloads a multi-sheet .xlsx workbook. Used by the import template so the
 * data sheet stays clean while a separate Instructions sheet documents fields.
 */
export function exportWorkbook(filename: string, sheets: ExcelSheet[]): void {
  if (sheets.length === 0) throw new Error("A workbook needs at least one sheet");

  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.colWidths) ws["!cols"] = sheet.colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  // Ensure .xlsx extension.
  const name = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, name);
}

export function exportExcel(
  filename: string,
  sheetName: string,
  rows: (string | number | null)[][],
  colWidths?: { wch: number }[]
): void {
  exportWorkbook(filename, [{ name: sheetName, rows, colWidths }]);
}

export interface SheetData {
  headers: string[];
  /** Data rows (header row excluded), each as an array of trimmed strings. */
  rows: string[][];
}

/**
 * Reads the first sheet of an uploaded .xlsx/.xls/.csv file and returns
 * its header row plus data rows as plain strings.
 */
export async function readSpreadsheet(file: File): Promise<SheetData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets");
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (aoa.length === 0) throw new Error("The file is empty");

  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows = aoa.slice(1).map((row) => {
    const cells: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      cells.push(String((row as unknown[])[i] ?? "").trim());
    }
    return cells;
  });
  // Drop fully-empty trailing rows (common in hand-edited spreadsheets).
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) {
    rows.pop();
  }
  return { headers, rows };
}
