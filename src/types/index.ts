export type UserRole = "owner" | "manager" | "staff_warehouse" | "staff_site" | "viewer";

export type LocationType = "WAREHOUSE" | "SITE";

export type POStatus = "DRAFT" | "PENDING" | "PARTIAL" | "RECEIVED" | "CANCELLED";
export type DispatchStatus = "DRAFT" | "DISPATCHED" | "ACKNOWLEDGED";
export type ReturnStatus = "DRAFT" | "RETURNED" | "ACKNOWLEDGED";
export type TransferStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type Currency = "MMK" | "USD";
export type BarcodeFormat = "CODE128" | "EAN13" | "QR";
export type ProductStatus = "ACTIVE" | "DISCONTINUED";
export type SiteType = "BRANCH" | "PROJECT" | "OFFICE" | "OTHER";
export type WriteOffReason = "DAMAGED" | "EXPIRED" | "LOST" | "OTHER";
export type ReturnReason = "UNUSED" | "DEFECTIVE" | "WRONG_ITEM" | "PROJECT_COMPLETED" | "OTHER";
export type AuditStatus = "IN_PROGRESS" | "COMPLETED";
export type ContactType = "SUPPLIER" | "OTHER";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  /** Site this user belongs to (receiving end). null = not assigned to a site. */
  site_id?: string | null;
  /** Drawn signature stored as a data:image/png;base64,... URL. */
  signature?: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  base_currency: Currency;
  usd_rate: number;
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface OrgUser {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  assigned_locations: { type: LocationType; id: string }[];
}

export interface Warehouse {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  contact_person: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Site {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  site_type: SiteType;
  contact_person: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SiteReceiver {
  id: string;
  site_id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  org_id: string;
  name: string;
  sku: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  color: string | null;
  size: string | null;
  unit: string;
  barcode_value: string | null;
  barcode_format: BarcodeFormat | null;
  reorder_point: number;
  base_cost_mmk: number;
  last_purchase_cost_mmk: number;
  upc_eans: string[];
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  product_id: string;
  org_id: string;
  location_type: LocationType;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  status: StockStatus;
  updated_at: string;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  org_id: string;
  cost_mmk: number;
  usd_rate: number;
  recorded_at: string;
  source: "PO" | "MANUAL";
}

export interface Contact {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: ContactType;
  blacklist_status: boolean;
  notes: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  org_id: string;
  supplier_id: string;
  warehouse_id: string;
  po_number: string;
  status: POStatus;
  currency: Currency;
  usd_rate: number;
  total_mmk: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface POLineItem {
  id: string;
  po_id: string;
  product_id: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost_mmk: number;
  status: POStatus;
  /** Where this line is delivered on receive: the PO warehouse (default) or a site directly. */
  dest_type?: LocationType;
  /** Site id when dest_type is SITE; when omitted the PO's warehouse is used. */
  dest_id?: string | null;
}

export interface POReceipt {
  id: string;
  po_id: string;
  org_id: string;
  slip_number: string;
  supplier_slip_seq: number;
  received_by: string;
  received_items: { product_id: string; qty: number }[];
  received_at: string;
  /** Signature of the receiving user, stored as a data:image/png;base64,... URL. */
  receiver_signature?: string | null;
}

export interface POAttachment {
  id: string;
  po_id: string;
  org_id: string;
  file_name: string;
  storage_path: string;
  file_type: "PDF" | "IMAGE";
  file_size_bytes: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Dispatch {
  id: string;
  org_id: string;
  from_warehouse_id: string;
  to_site_id: string;
  dispatch_number: string;
  status: DispatchStatus;
  sender_name: string;
  receiver_name: string;
  receiver_signature: string | null;
  dispatch_note: string | null;
  dispatched_by: string;
  dispatched_at: string;
  /** When the receiving end signed for this dispatch. */
  acknowledged_at?: string | null;
  /** User id of whoever signed at the receiving end. */
  acknowledged_by?: string | null;
}

export interface DispatchLineItem {
  id: string;
  dispatch_id: string;
  product_id: string;
  quantity: number;
}

export type UserNotificationType = "DISPATCH_CREATED" | "DISPATCH_ACKNOWLEDGED";

export interface UserNotification {
  id: string;
  org_id: string;
  recipient_id: string;
  actor_id: string | null;
  type: UserNotificationType;
  title: string;
  message: string;
  href: string;
  created_at: string;
  read_at: string | null;
}

export interface SiteReturn {
  id: string;
  org_id: string;
  from_site_id: string;
  to_warehouse_id: string;
  origin_dispatch_id: string | null;
  return_number: string;
  status: ReturnStatus;
  sender_name: string;
  sender_signature: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface SiteReturnLineItem {
  id: string;
  return_id: string;
  product_id: string;
  quantity: number;
  reason: ReturnReason;
  condition_notes: string | null;
}

export interface StockTransfer {
  id: string;
  org_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_number: string;
  status: TransferStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface TransferLineItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
}

export interface SupplierReturn {
  id: string;
  org_id: string;
  supplier_id: string;
  warehouse_id: string;
  return_number: string;
  reason: string;
  status: ReturnStatus;
  items: { product_id: string; quantity: number; unit_cost_mmk: number }[];
  created_by: string;
  created_at: string;
}

export interface WriteOff {
  id: string;
  org_id: string;
  location_type: LocationType;
  location_id: string;
  product_id: string;
  quantity: number;
  reason: WriteOffReason;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface Audit {
  id: string;
  org_id: string;
  location_type: LocationType;
  location_id: string;
  status: AuditStatus;
  count_sheet: { product_id: string; expected: number; actual: number | null }[];
  discrepancies: { product_id: string; expected: number; actual: number; diff: number }[];
  created_by: string;
  approved_by: string | null;
  created_at: string;
  completed_at: string | null;
}
