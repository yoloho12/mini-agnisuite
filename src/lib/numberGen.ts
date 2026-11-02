export function generatePoNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `PO-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateDispatchNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `DISP-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateReturnNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `RET-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateTransferNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `TRF-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateSupplierReturnNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `SRET-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateSlipNumber(supplierName: string, seq: number): string {
  const short = supplierName.replace(/[^a-zA-Z]/g, "").slice(0, 10);
  return `SUP-${short}/SLIP-${String(seq).padStart(4, "0")}`;
}

export function generateAuditNumber(seq: number): string {
  const year = new Date().getFullYear();
  return `AUD-${year}-${String(seq).padStart(4, "0")}`;
}
