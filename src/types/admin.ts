import type { UserRole } from "@/types";

export type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** A member of the current organization, as shown in the admin panel. */
export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  siteId: string | null;
  assignedLocations: string[];
  createdAt: string;
}

export interface AdminLocationOption {
  id: string;
  name: string;
}

export interface AdminOverview {
  users: AdminUser[];
  warehouses: AdminLocationOption[];
  sites: AdminLocationOption[];
  /** Demo mode stores accounts locally and uses the account switcher, not passwords. */
  demoMode: boolean;
  currentUserId: string;
}

export interface AdminUserInput {
  fullName: string;
  role: UserRole;
  siteId: string | null;
  assignedLocations: string[];
}

export interface CreateAdminUserInput extends AdminUserInput {
  email: string;
  /** Required in live Supabase mode; ignored by the local demo store. */
  password?: string;
}
