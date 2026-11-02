import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_DEV_ORG_ID, DEV_ACCOUNTS } from "@/lib/demo/devAccounts";
import type { UserRole } from "@/types";
import { canAccessLocation, normalizeAssignedLocations } from "@/lib/locationAccess";

export async function getCurrentOrgId(): Promise<string> {
  const cookieStore = await cookies();

  const dev = cookieStore.get("dev-bypass-user");
  if (dev) {
    try {
      const parsed = JSON.parse(dev.value);
      if (typeof parsed.org_id === "string" && parsed.org_id) {
        return parsed.org_id;
      }
      const account = DEV_ACCOUNTS.find((candidate) => candidate.id === parsed.id);
      if (account) return account.org_id;

      // Accounts created from the admin panel are stored locally, so resolve
      // their organization from the membership row.
      const supabase = await createClient();
      const { data } = await supabase
        .from("org_users")
        .select("org_id")
        .eq("user_id", parsed.id)
        .maybeSingle();
      if (data?.org_id) return data.org_id as string;
      return DEFAULT_DEV_ORG_ID;
    } catch {
      // fall through
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "demo-org";

  const { data } = await supabase
    .from("org_users")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.org_id ?? "demo-org";
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  org_id: string;
  site_id: string | null;
  signature: string | null;
  assigned_locations: string[];
}

/**
 * Resolve the signed-in user with their profile extras (site assignment +
 * stored drawn signature). Returns null when there is no identity at all.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const dev = cookieStore.get("dev-bypass-user");

  let id: string;
  let email: string;
  let baseName: string;
  let baseRole: UserRole;
  let baseSiteId: string | null = null;
  let baseSignature: string | null = null;

  if (dev) {
    try {
      const parsed = JSON.parse(dev.value);
      id = parsed.id ?? "dev-user-000";
      email = parsed.email ?? "";
      baseName = parsed.full_name ?? "";
      const account = DEV_ACCOUNTS.find((candidate) => candidate.id === parsed.id);
      baseRole = account?.role ?? (parsed.role as UserRole | undefined) ?? "viewer";
      baseSiteId = account?.site_id ?? (parsed.site_id as string | null | undefined) ?? null;
      baseSignature = account?.signature ?? (parsed.signature as string | null | undefined) ?? null;
    } catch {
      id = "dev-user-000";
      email = "";
      baseName = "";
      baseRole = "owner";
    }
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    id = user.id;
    email = user.email ?? "";
    baseName = (user.user_metadata?.full_name as string) ?? "";
    baseRole = "viewer";
  }

  const org_id = await getCurrentOrgId();

  let full_name = baseName;
  let role: UserRole = "viewer";
  let site_id: string | null = baseSiteId;
  let signature: string | null = baseSignature;
  let assigned_locations: string[] = [];

  try {
    const supabase = await createClient();
    const [{ data: profile }, { data: membership, error: membershipError }] = await Promise.all([
      supabase
      .from("profiles")
      .select("full_name, site_id, signature")
      .eq("id", id)
      .maybeSingle(),
      supabase
        .from("org_users")
        .select("role, assigned_locations")
        .eq("org_id", org_id)
        .eq("user_id", id)
        .maybeSingle(),
    ]);
    if (profile?.full_name) full_name = profile.full_name as string;
    site_id = (profile?.site_id as string | null) ?? baseSiteId;
    signature = (profile?.signature as string | null) ?? baseSignature;
    if (membership?.role) role = membership.role as UserRole;
    // Only use the cookie role when the membership lookup itself failed. If
    // the lookup succeeded with no row, the account has been removed and must
    // lose its privileges.
    else if (membershipError && dev) role = baseRole;
    assigned_locations = normalizeAssignedLocations(membership?.assigned_locations);
  } catch {
    // profile row not created yet — fall back to the base identity
    if (dev) role = baseRole;
  }

  return { id, email, full_name, role, org_id, site_id, signature, assigned_locations };
}

export async function requireRole(allowedRoles: readonly UserRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to perform this action.");
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Your account does not have permission to perform this action.");
  }
  return user;
}

export async function requireLocationAccess(
  locationType: "WAREHOUSE" | "SITE",
  locationId: string
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to perform this action.");
  if (!canAccessLocation(user, locationType, locationId)) {
    throw new Error("Your account is not assigned to this location.");
  }
  return user;
}

export function assertOrganizationRecord<T extends { org_id?: string }>(
  record: T | null,
  orgId: string,
  label = "Record"
): asserts record is T & { org_id: string } {
  if (!record || record.org_id !== orgId) {
    throw new Error(`${label} not found.`);
  }
}