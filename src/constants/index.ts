import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/types";

export const ROLES = {
  owner: "Owner",
  manager: "Manager",
  staff_warehouse: "Staff (Warehouse)",
  staff_site: "Staff (Site)",
  viewer: "Viewer",
} as const;

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Full access. Manage user accounts, organization settings, backups, and all inventory.",
  manager: "Manage inventory and daily operations across every location. Cannot manage user accounts.",
  staff_warehouse: "Work with stock and operations at locations assigned to this account.",
  staff_site: "Receive and return stock at assigned locations.",
  viewer: "Read-only access to inventory, reports, and alerts at assigned locations.",
};

export const PO_STATUSES = ["DRAFT", "PENDING", "PARTIAL", "RECEIVED", "CANCELLED"] as const;
export const DISPATCH_STATUSES = ["DRAFT", "DISPATCHED", "ACKNOWLEDGED"] as const;
export const RETURN_STATUSES = ["DRAFT", "RETURNED", "ACKNOWLEDGED"] as const;
export const STOCK_STATUSES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const;

export const WRITE_OFF_REASONS = ["DAMAGED", "EXPIRED", "LOST", "OTHER"] as const;
export const RETURN_REASONS = ["UNUSED", "DEFECTIVE", "WRONG_ITEM", "PROJECT_COMPLETED", "OTHER"] as const;

export const SITE_TYPES = ["BRANCH", "PROJECT", "OFFICE", "OTHER"] as const;
export const PRODUCT_UNITS = ["pcs", "box", "carton", "roll", "meter", "kg", "viss", "pair", "set", "lot"] as const;
export const PRODUCT_CATEGORIES = [
  "PPE",
  "Safety Gear",
  "Footwear",
  "Tools",
  "Hardware",
  "Materials",
  "Consumables",
  "Electronics",
  "Other",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted/20 text-muted",
  PENDING: "bg-accent/20 text-accent",
  PARTIAL: "bg-accent/20 text-accent",
  RECEIVED: "bg-success/20 text-success",
  CANCELLED: "bg-danger/20 text-danger",
  DISPATCHED: "bg-primary/20 text-primary",
  ACKNOWLEDGED: "bg-success/20 text-success",
  RETURNED: "bg-success/20 text-success",
  COMPLETED: "bg-success/20 text-success",
  IN_STOCK: "bg-success/20 text-success",
  LOW_STOCK: "bg-accent/20 text-accent",
  OUT_OF_STOCK: "bg-danger/20 text-danger",
  ACTIVE: "bg-success/20 text-success",
  DISCONTINUED: "bg-danger/20 text-danger",
};

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard", permission: PERMISSIONS.view_dashboard },
  { label: "Products", href: "/products", icon: "Package", permission: PERMISSIONS.view_products },
  { label: "Warehouses", href: "/warehouses", icon: "Warehouse", permission: PERMISSIONS.view_warehouses },
  { label: "Sites", href: "/sites", icon: "MapPin", permission: PERMISSIONS.view_sites },
  { label: "Purchase Orders", href: "/purchase-orders", icon: "ShoppingCart", permission: PERMISSIONS.view_purchase_orders },
  { label: "Dispatches", href: "/dispatches", icon: "Truck", permission: PERMISSIONS.view_dispatches },
  { label: "Site Returns", href: "/site-returns", icon: "RotateCcw", permission: PERMISSIONS.view_site_returns },
  { label: "Transfers", href: "/transfers", icon: "ArrowLeftRight", permission: PERMISSIONS.view_transfers },
  { label: "Return to Supplier", href: "/returns", icon: "Undo2", permission: PERMISSIONS.view_supplier_returns },
  { label: "Write-offs", href: "/write-offs", icon: "Trash2", permission: PERMISSIONS.view_write_offs },
  { label: "Stock Audits", href: "/audits", icon: "ClipboardCheck", permission: PERMISSIONS.view_audits },
  { label: "Scanner", href: "/scanner", icon: "ScanBarcode", permission: PERMISSIONS.view_products },
  { label: "Alerts", href: "/alerts", icon: "Bell", permission: PERMISSIONS.view_alerts },
  { label: "Reports", href: "/reports", icon: "FileBarChart", permission: PERMISSIONS.view_reports },
  { label: "Contacts", href: "/contacts", icon: "Users", permission: PERMISSIONS.view_contacts },
  { label: "Admin", href: "/admin", icon: "ShieldCheck", permission: PERMISSIONS.manage_users },
  { label: "Settings", href: "/settings", icon: "Settings", permission: PERMISSIONS.view_settings },
] as const satisfies Array<{
  label: string;
  href: string;
  icon: string;
  permission?: Permission;
  ownerOnly?: boolean;
}>;
