import type { UserRole } from "@/types";

export const PERMISSIONS = {
  view_dashboard: "view_dashboard",
  view_products: "view_products",
  manage_products: "manage_products",
  view_warehouses: "view_warehouses",
  manage_master_data: "manage_master_data",
  view_sites: "view_sites",
  view_purchase_orders: "view_purchase_orders",
  create_purchase_orders: "create_purchase_orders",
  receive_purchase_orders: "receive_purchase_orders",
  view_dispatches: "view_dispatches",
  create_dispatches: "create_dispatches",
  acknowledge_dispatches: "acknowledge_dispatches",
  view_site_returns: "view_site_returns",
  create_site_returns: "create_site_returns",
  view_supplier_returns: "view_supplier_returns",
  create_supplier_returns: "create_supplier_returns",
  view_transfers: "view_transfers",
  create_transfers: "create_transfers",
  view_write_offs: "view_write_offs",
  create_write_offs: "create_write_offs",
  view_audits: "view_audits",
  create_audits: "create_audits",
  view_alerts: "view_alerts",
  view_reports: "view_reports",
  view_contacts: "view_contacts",
  view_settings: "view_settings",
  manage_users: "manage_users",
  manage_organization: "manage_organization",
  manage_backups: "manage_backups",
  view_costs: "view_costs",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  manager: [
    PERMISSIONS.view_dashboard,
    PERMISSIONS.view_products,
    PERMISSIONS.manage_products,
    PERMISSIONS.view_warehouses,
    PERMISSIONS.manage_master_data,
    PERMISSIONS.view_sites,
    PERMISSIONS.view_purchase_orders,
    PERMISSIONS.create_purchase_orders,
    PERMISSIONS.receive_purchase_orders,
    PERMISSIONS.view_dispatches,
    PERMISSIONS.create_dispatches,
    PERMISSIONS.acknowledge_dispatches,
    PERMISSIONS.view_site_returns,
    PERMISSIONS.create_site_returns,
    PERMISSIONS.view_supplier_returns,
    PERMISSIONS.create_supplier_returns,
    PERMISSIONS.view_transfers,
    PERMISSIONS.create_transfers,
    PERMISSIONS.view_write_offs,
    PERMISSIONS.create_write_offs,
    PERMISSIONS.view_audits,
    PERMISSIONS.create_audits,
    PERMISSIONS.view_alerts,
    PERMISSIONS.view_reports,
    PERMISSIONS.view_contacts,
    PERMISSIONS.view_settings,
    PERMISSIONS.view_costs,
  ],
  staff_warehouse: [
    PERMISSIONS.view_dashboard,
    PERMISSIONS.view_products,
    PERMISSIONS.view_warehouses,
    PERMISSIONS.view_sites,
    PERMISSIONS.view_purchase_orders,
    PERMISSIONS.receive_purchase_orders,
    PERMISSIONS.view_dispatches,
    PERMISSIONS.create_dispatches,
    PERMISSIONS.view_site_returns,
    PERMISSIONS.view_supplier_returns,
    PERMISSIONS.view_transfers,
    PERMISSIONS.create_transfers,
    PERMISSIONS.view_write_offs,
    PERMISSIONS.view_audits,
    PERMISSIONS.view_alerts,
    PERMISSIONS.view_reports,
    PERMISSIONS.view_contacts,
    PERMISSIONS.view_settings,
    PERMISSIONS.view_costs,
  ],
  staff_site: [
    PERMISSIONS.view_dashboard,
    PERMISSIONS.view_products,
    PERMISSIONS.view_warehouses,
    PERMISSIONS.view_sites,
    PERMISSIONS.view_purchase_orders,
    PERMISSIONS.receive_purchase_orders,
    PERMISSIONS.view_dispatches,
    PERMISSIONS.acknowledge_dispatches,
    PERMISSIONS.view_site_returns,
    PERMISSIONS.create_site_returns,
    PERMISSIONS.view_supplier_returns,
    PERMISSIONS.view_transfers,
    PERMISSIONS.view_write_offs,
    PERMISSIONS.create_write_offs,
    PERMISSIONS.view_audits,
    PERMISSIONS.create_audits,
    PERMISSIONS.view_alerts,
    PERMISSIONS.view_reports,
    PERMISSIONS.view_contacts,
    PERMISSIONS.view_settings,
    PERMISSIONS.view_costs,
  ],
  viewer: [
    PERMISSIONS.view_dashboard,
    PERMISSIONS.view_products,
    PERMISSIONS.view_warehouses,
    PERMISSIONS.view_sites,
    PERMISSIONS.view_purchase_orders,
    PERMISSIONS.view_dispatches,
    PERMISSIONS.view_site_returns,
    PERMISSIONS.view_supplier_returns,
    PERMISSIONS.view_transfers,
    PERMISSIONS.view_write_offs,
    PERMISSIONS.view_audits,
    PERMISSIONS.view_alerts,
    PERMISSIONS.view_reports,
    PERMISSIONS.view_contacts,
    PERMISSIONS.view_settings,
    PERMISSIONS.view_costs,
  ],
};

export function canRole(role: UserRole | null | undefined, allowed: readonly UserRole[]): boolean {
  return Boolean(role) && allowed.includes(role as UserRole);
}

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission | null | undefined
): boolean {
  if (!role || !permission) return false;
  return ROLE_PERMISSIONS[role].includes(permission as Permission);
}

export function hasAnyPermission(
  role: UserRole | null | undefined,
  permissions: readonly Permission[]
): boolean {
  if (!role || permissions.length === 0) return false;
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(
  role: UserRole | null | undefined,
  permissions: readonly Permission[]
): boolean {
  if (!role || permissions.length === 0) return false;
  return permissions.every((permission) => hasPermission(role, permission));
}

export function getRolesWithPermission(permission: Permission): UserRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter((role) =>
    hasPermission(role, permission)
  );
}

export const WRITE_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.manage_products);
export const OPERATE_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_dispatches);
export const RECEIVE_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.receive_purchase_orders);
export const VIEW_ROLES: UserRole[] = (Object.keys(ROLE_PERMISSIONS) as UserRole[]).slice();
export const ADMIN_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.manage_users);
export const PURCHASE_ORDER_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_purchase_orders);
export const DISPATCH_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_dispatches);
export const SITE_RETURN_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_site_returns);
export const SUPPLIER_RETURN_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_supplier_returns);
export const TRANSFER_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_transfers);
export const WRITE_OFF_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_write_offs);
export const AUDIT_ROLES: UserRole[] = getRolesWithPermission(PERMISSIONS.create_audits);

/** Whether the given role may create/edit/delete products. */
export function canManageProduct(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.manage_products);
}

/** Whether the given role may manage warehouses, sites, and contacts. */
export function canManageMasterData(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.manage_master_data);
}

/** Whether the given role may create operational records. */
export function canOperate(role: UserRole | null | undefined): boolean {
  return hasAnyPermission(role, [
    PERMISSIONS.create_dispatches,
    PERMISSIONS.create_purchase_orders,
    PERMISSIONS.create_site_returns,
    PERMISSIONS.create_supplier_returns,
    PERMISSIONS.create_transfers,
    PERMISSIONS.create_write_offs,
    PERMISSIONS.create_audits,
  ]);
}

/** Whether the given role may acknowledge receipts. */
export function canReceive(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.acknowledge_dispatches);
}

export function canCreatePurchaseOrder(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.create_purchase_orders);
}

export function canCreateDispatch(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.create_dispatches);
}

export function canAcknowledgeDispatch(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.acknowledge_dispatches);
}

export function canCreateSiteReturn(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.create_site_returns);
}

export function canCreateSupplierReturn(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.create_supplier_returns);
}

export function canCreateTransfer(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.create_transfers);
}

export function canCreateWriteOff(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.create_write_offs);
}

export function canCreateAudit(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.create_audits);
}

export function canReceivePurchaseOrder(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.receive_purchase_orders);
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.manage_users);
}

export function canManageBackups(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.manage_backups);
}

export function canManageOrganization(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.manage_organization);
}

export function canViewCosts(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.view_costs);
}

export function canViewSection(
  role: UserRole | null | undefined,
  section: Permission | null | undefined
): boolean {
  return hasPermission(role, section);
}

interface RouteRule {
  /** Route prefix, matched on segment boundaries. */
  prefix: string;
  roles?: UserRole[];
  permission?: Permission;
}

/**
 * Role-restricted routes. Order matters: the first matching prefix wins, so
 * specific sub-routes must come before broader ones.
 */
const ROUTE_RULES: RouteRule[] = [
  { prefix: "/admin", roles: ADMIN_ROLES },
  { prefix: "/purchase-orders/new", roles: PURCHASE_ORDER_ROLES },
  { prefix: "/dispatches/new", roles: DISPATCH_ROLES },
  { prefix: "/site-returns/new", roles: SITE_RETURN_ROLES },
  { prefix: "/returns/new", roles: SUPPLIER_RETURN_ROLES },
  { prefix: "/transfers/new", roles: TRANSFER_ROLES },
  { prefix: "/write-offs/new", roles: WRITE_OFF_ROLES },
  { prefix: "/audits/new", roles: AUDIT_ROLES },
];

/** Whether a role may open the given pathname. Unknown paths are open to all signed-in roles. */
export function canAccessRoute(pathname: string, role: UserRole | null | undefined): boolean {
  const rule = ROUTE_RULES.find(
    (candidate) => pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`)
  );
  if (!rule) return true;
  if (rule.permission && !hasPermission(role, rule.permission)) return false;
  if (rule.roles && !canRole(role, rule.roles)) return false;
  return true;
}

interface NavRule {
  /** Sidebar link href. */
  href: string;
  roles?: UserRole[];
  permission?: Permission;
}

const NAV_RULES: NavRule[] = [
  { href: "/products", permission: PERMISSIONS.view_products },
  { href: "/warehouses", permission: PERMISSIONS.view_warehouses },
  { href: "/sites", permission: PERMISSIONS.view_sites },
  { href: "/purchase-orders", permission: PERMISSIONS.view_purchase_orders },
  { href: "/dispatches", permission: PERMISSIONS.view_dispatches },
  { href: "/site-returns", permission: PERMISSIONS.view_site_returns },
  { href: "/returns", permission: PERMISSIONS.view_supplier_returns },
  { href: "/transfers", permission: PERMISSIONS.view_transfers },
  { href: "/write-offs", permission: PERMISSIONS.view_write_offs },
  { href: "/audits", permission: PERMISSIONS.view_audits },
  { href: "/scanner", permission: PERMISSIONS.view_products },
  { href: "/alerts", permission: PERMISSIONS.view_alerts },
  { href: "/reports", permission: PERMISSIONS.view_reports },
  { href: "/contacts", permission: PERMISSIONS.view_contacts },
  { href: "/admin", permission: PERMISSIONS.manage_users },
  { href: "/settings", permission: PERMISSIONS.view_settings },
];

/** Whether the sidebar should show this module for the given role. */
export function canAccessNavItem(href: string, role: UserRole | null | undefined): boolean {
  const rule = NAV_RULES.find((candidate) => candidate.href === href);
  if (!rule) return true;
  if (!role) return true;
  if (rule.permission && !hasPermission(role, rule.permission)) return false;
  if (rule.roles && !canRole(role, rule.roles)) return false;
  return true;
}

export type UserRoleLabel = Record<UserRole, string>;

export const ROLE_LABELS: UserRoleLabel = {
  owner: "Owner",
  manager: "Manager",
  staff_warehouse: "Staff (Warehouse)",
  staff_site: "Staff (Site)",
  viewer: "Viewer",
};
