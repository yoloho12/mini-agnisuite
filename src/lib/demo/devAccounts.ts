import type { UserRole } from "@/types";

export const DEFAULT_DEV_ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface DevAccount {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  org_id: string;
  site_id: string | null;
  signature: string | null;
}

export const DEV_ACCOUNTS: ReadonlyArray<DevAccount> = [
  {
    id: "dev-user-000",
    email: "owner@demo.local",
    full_name: "Demo Owner",
    role: "owner",
    org_id: "00000000-0000-0000-0000-000000000001",
    site_id: null,
    signature: "Demo Owner",
  },
  {
    id: "dev-user-manager",
    email: "manager@demo.local",
    full_name: "Demo Manager",
    role: "manager",
    org_id: "00000000-0000-0000-0000-000000000001",
    site_id: null,
    signature: "Demo Manager",
  },
  {
    id: "dev-user-warehouse",
    email: "warehouse@demo.local",
    full_name: "Warehouse Staff",
    role: "staff_warehouse",
    org_id: "00000000-0000-0000-0000-000000000001",
    site_id: null,
    signature: "Warehouse Staff",
  },
  {
    id: "dev-user-site",
    email: "site@demo.local",
    full_name: "Dawbon Site Staff",
    role: "staff_site",
    org_id: "00000000-0000-0000-0000-000000000001",
    site_id: "site-0001",
    signature: "Dawbon Site Staff",
  },
  {
    id: "dev-user-viewer",
    email: "viewer@demo.local",
    full_name: "Demo Viewer",
    role: "viewer",
    org_id: "00000000-0000-0000-0000-000000000001",
    site_id: null,
    signature: null,
  },
  {
    id: "dev-user-other-org",
    email: "other-org@demo.local",
    full_name: "Other Organization Owner",
    role: "owner",
    org_id: "00000000-0000-0000-0000-000000000002",
    site_id: null,
    signature: "Other Organization Owner",
  },
];

export const DEV_ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff_warehouse: "Warehouse staff",
  staff_site: "Site staff",
  viewer: "Viewer",
};
