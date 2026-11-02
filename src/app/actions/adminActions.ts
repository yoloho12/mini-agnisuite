"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createSupabaseContext } from "@/lib/supabase/server";
import { getCurrentOrgId, requireRole } from "@/lib/auth";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import * as siteRepo from "@/repositories/siteRepo";
import { DEV_ACCOUNTS } from "@/lib/demo/devAccounts";
import { getTable } from "@/lib/demo/data";
import type { DemoClient } from "@/lib/demo/demoClient";
import { friendlyErrorMessage } from "@/lib/errors";
import { normalizeAssignedLocations } from "@/lib/locationAccess";
import { ROLES } from "@/constants";
import type { UserRole } from "@/types";
import type {
  AdminLocationOption,
  AdminOverview,
  AdminResult,
  AdminUser,
  AdminUserInput,
  CreateAdminUserInput,
} from "@/types/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_RANK: Record<UserRole, number> = {
  owner: 0,
  manager: 1,
  staff_warehouse: 2,
  staff_site: 3,
  viewer: 4,
};

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && value in ROLES;
}

function normalizeRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "viewer";
}

/**
 * `assigned_locations` is stored as an array of location ids. Older/imported
 * data may contain `{ type, id }` objects, so accept both shapes.
 */
function normalizeAssigned(value: unknown): string[] {
  return normalizeAssignedLocations(value);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

async function isDemoMode(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS !== "true") return false;
  const cookieStore = await cookies();
  return Boolean(cookieStore.get("dev-bypass-user"));
}

/** Service-role client used only in live Supabase mode. */
async function getLiveAdmin(): Promise<SupabaseClient> {
  const context = await createSupabaseContext();
  if (!context.data) throw context.error;
  // `createAdminClient` is typed against an empty schema; the admin panel
  // works with untyped table payloads, so widen it here.
  return context.data.supabaseAdmin as unknown as SupabaseClient;
}

interface LocationSets {
  warehouses: AdminLocationOption[];
  sites: AdminLocationOption[];
  warehouseIds: Set<string>;
  siteIds: Set<string>;
}

async function loadLocations(orgId: string): Promise<LocationSets> {
  const [warehouses, sites] = await Promise.all([
    warehouseRepo.getWarehouses(orgId),
    siteRepo.getSites(orgId),
  ]);
  return {
    warehouses: warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name })),
    sites: sites.map((site) => ({ id: site.id, name: site.name })),
    warehouseIds: new Set(warehouses.map((warehouse) => warehouse.id)),
    siteIds: new Set(sites.map((site) => site.id)),
  };
}

async function getMembership(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_users")
    .select("role, assigned_locations")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    role: normalizeRole(data.role),
    assigned_locations: data.assigned_locations,
  };
}

async function countOwners(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_users")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner");
  if (error) throw error;
  return (data ?? []).length;
}

async function loadUsers(orgId: string, demoMode: boolean): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("org_users")
    .select("user_id, role, assigned_locations")
    .eq("org_id", orgId);
  if (error) throw error;

  const rows = (memberships ?? []) as Array<Record<string, unknown>>;
  const ids = uniqueStrings(rows.map((row) => String(row.user_id ?? "")));
  if (ids.length === 0) return [];

  // Live profiles do not have an email column; auth emails come from the
  // admin API below. Demo profiles may carry an extra `email` field.
  const profileColumns = demoMode
    ? "id, full_name, email, site_id, created_at"
    : "id, full_name, site_id, created_at";
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select(profileColumns)
    .in("id", ids);
  if (profileError) throw profileError;

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const profile of (profiles ?? []) as Array<Record<string, unknown>>) {
    profileMap.set(String(profile.id), profile);
  }

  const emailMap = new Map<string, string>();
  if (demoMode) {
    for (const account of DEV_ACCOUNTS) emailMap.set(account.id, account.email);
  } else {
    try {
      const admin = await getLiveAdmin();
      let page = 1;
      while (page <= 10) {
        const { data: list, error: listError } = await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (listError) break;
        const authUsers = list?.users ?? [];
        for (const authUser of authUsers) {
          emailMap.set(authUser.id, authUser.email ?? "");
        }
        if (authUsers.length < 1000) break;
        page += 1;
      }
    } catch (err) {
      // The panel still works without auth emails; don't block user listing.
      console.warn("[admin] could not load auth emails:", err);
    }
  }

  const staticById = new Map(DEV_ACCOUNTS.map((account) => [account.id, account]));

  const users: AdminUser[] = rows.map((row) => {
    const id = String(row.user_id);
    const profile = profileMap.get(id);
    const staticAccount = staticById.get(id);
    const profileEmail = demoMode ? String(profile?.email ?? "") : "";
    return {
      id,
      email: profileEmail || emailMap.get(id) || "",
      fullName: String(profile?.full_name ?? staticAccount?.full_name ?? ""),
      role: normalizeRole(row.role),
      siteId:
        (profile?.site_id as string | null | undefined) ??
        staticAccount?.site_id ??
        null,
      assignedLocations: normalizeAssigned(row.assigned_locations),
      createdAt: String(profile?.created_at ?? ""),
    };
  });

  users.sort((a, b) => {
    const byRole = ROLE_RANK[a.role] - ROLE_RANK[b.role];
    if (byRole !== 0) return byRole;
    return (a.fullName || a.email).localeCompare(b.fullName || b.email);
  });
  return users;
}

function sanitizeLocations(input: AdminUserInput, locations: LocationSets): string[] {
  return uniqueStrings(input.assignedLocations ?? []).filter(
    (id) => locations.warehouseIds.has(id) || locations.siteIds.has(id)
  );
}

function validateUserInput(input: AdminUserInput, locations: LocationSets): string | null {
  const fullName = (input.fullName ?? "").trim();
  if (!fullName) return "Full name is required.";
  if (fullName.length > 120) return "Full name must be 120 characters or fewer.";
  if (!isUserRole(input.role)) return "Choose a valid role.";
  if (input.siteId && !locations.siteIds.has(input.siteId)) {
    return "Choose a site in your organization.";
  }

  const assigned = sanitizeLocations(input, locations);
  if (
    input.role === "staff_warehouse" &&
    !assigned.some((id) => locations.warehouseIds.has(id))
  ) {
    return "Assign at least one warehouse to warehouse staff.";
  }
  if (
    input.role === "staff_site" &&
    !input.siteId &&
    !assigned.some((id) => locations.siteIds.has(id))
  ) {
    return "Choose a primary site or assign at least one site to site staff.";
  }
  return null;
}

export async function fetchAdminOverview(): Promise<AdminResult<AdminOverview>> {
  try {
    const current = await requireRole(["owner"]);
    const orgId = await getCurrentOrgId();
    const demoMode = await isDemoMode();
    const [locations, users] = await Promise.all([
      loadLocations(orgId),
      loadUsers(orgId, demoMode),
    ]);

    return {
      ok: true,
      data: {
        users,
        warehouses: locations.warehouses,
        sites: locations.sites,
        demoMode,
        currentUserId: current.id,
      },
    };
  } catch (err) {
    console.error("[admin] fetchAdminOverview failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not load the admin panel.") };
  }
}

export async function createAdminUser(
  input: CreateAdminUserInput
): Promise<AdminResult<AdminUser>> {
  try {
    await requireRole(["owner"]);
    const orgId = await getCurrentOrgId();
    const demoMode = await isDemoMode();
    const fullName = (input.fullName ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }

    const locations = await loadLocations(orgId);
    const validation = validateUserInput({ ...input, fullName }, locations);
    if (validation) return { ok: false, error: validation };

    const assignedLocations = sanitizeLocations(input, locations);
    const siteId =
      input.siteId && locations.siteIds.has(input.siteId) ? input.siteId : null;

    if (demoMode) {
      return await createDemoUser(
        { ...input, fullName, email, siteId, assignedLocations },
        orgId
      );
    }

    const password = input.password ?? "";
    if (password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const admin = await getLiveAdmin();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError) throw createError;
    if (!created.user) throw new Error("Could not create the sign-in account.");

    const userId = created.user.id;
    try {
      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        role: input.role,
        site_id: siteId,
      });
      if (profileError) throw profileError;

      const { error: membershipError } = await admin.from("org_users").insert({
        org_id: orgId,
        user_id: userId,
        role: input.role,
        assigned_locations: assignedLocations,
      });
      if (membershipError) throw membershipError;
    } catch (err) {
      // Best-effort rollback so a failed membership doesn't leave a login
      // that cannot access anything.
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw err;
    }

    revalidatePath("/admin");
    return {
      ok: true,
      data: {
        id: userId,
        email,
        fullName,
        role: input.role,
        siteId,
        assignedLocations,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error("[admin] createAdminUser failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not create the account.") };
  }
}

async function createDemoUser(
  input: CreateAdminUserInput & {
    fullName: string;
    email: string;
    siteId: string | null;
    assignedLocations: string[];
  },
  orgId: string
): Promise<AdminResult<AdminUser>> {
  const supabase = (await createClient()) as DemoClient;
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, email");
  if (profileError) throw profileError;

  const profiles = (profileRows ?? []) as Array<Record<string, unknown>>;
  const existingProfile = profiles.find(
    (profile) => String(profile.email ?? "").toLowerCase() === input.email
  );
  const staticAccount = DEV_ACCOUNTS.find(
    (account) => account.email.toLowerCase() === input.email
  );
  const existingId = existingProfile
    ? String(existingProfile.id)
    : staticAccount?.id ?? null;

  if (existingId) {
    const { data: memberships, error: membershipError } = await supabase
      .from("org_users")
      .select("id")
      .eq("user_id", existingId);
    if (membershipError) throw membershipError;
    if ((memberships ?? []).length > 0) {
      return { ok: false, error: "An account with this email already exists." };
    }
  }

  const userId = existingId ?? `dev-user-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const profileRow = {
    id: userId,
    full_name: input.fullName,
    role: input.role,
    avatar_url: null,
    site_id: input.siteId,
    signature: staticAccount?.signature ?? null,
    email: input.email,
    created_at: now,
  };
  const membershipRow = {
    id: `membership-${crypto.randomUUID()}`,
    org_id: orgId,
    user_id: userId,
    role: input.role,
    assigned_locations: input.assignedLocations,
    created_at: now,
  };

  await supabase.atomic(["profiles", "org_users"], () => {
    const profileTable = getTable("profiles");
    const profile = profileTable.find((row) => row.id === userId);
    if (profile) {
      Object.assign(profile, {
        full_name: input.fullName,
        role: input.role,
        site_id: input.siteId,
        email: input.email,
      });
    } else {
      profileTable.push(profileRow);
    }
    getTable("org_users").push(membershipRow);
  });

  revalidatePath("/admin");
  return {
    ok: true,
    data: {
      id: userId,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      siteId: input.siteId,
      assignedLocations: input.assignedLocations,
      createdAt: now,
    },
  };
}

export async function updateAdminUser(
  userId: string,
  input: AdminUserInput
): Promise<AdminResult<AdminUser>> {
  try {
    const current = await requireRole(["owner"]);
    const orgId = await getCurrentOrgId();
    const demoMode = await isDemoMode();
    const membership = await getMembership(orgId, userId);
    if (!membership) {
      return { ok: false, error: "This user is not a member of your organization." };
    }

    const fullName = (input.fullName ?? "").trim();
    const locations = await loadLocations(orgId);
    const validation = validateUserInput({ ...input, fullName }, locations);
    if (validation) return { ok: false, error: validation };

    const assignedLocations = sanitizeLocations(input, locations);
    const siteId =
      input.siteId && locations.siteIds.has(input.siteId) ? input.siteId : null;

    if (userId === current.id && input.role !== "owner") {
      return { ok: false, error: "You cannot remove your own owner access." };
    }
    if (membership.role === "owner" && input.role !== "owner") {
      const owners = await countOwners(orgId);
      if (owners <= 1) {
        return { ok: false, error: "The organization must keep at least one owner." };
      }
    }

    if (demoMode) {
      const supabase = (await createClient()) as DemoClient;
      await supabase.atomic(["profiles", "org_users"], () => {
        const profile = getTable("profiles").find((row) => row.id === userId);
        if (profile) {
          Object.assign(profile, {
            full_name: fullName,
            role: input.role,
            site_id: siteId,
          });
        }
        const membershipRow = getTable("org_users").find(
          (row) => row.org_id === orgId && row.user_id === userId
        );
        if (membershipRow) {
          Object.assign(membershipRow, {
            role: input.role,
            assigned_locations: assignedLocations,
          });
        }
      });
    } else {
      const admin = await getLiveAdmin();
      const { error: profileError } = await admin
        .from("profiles")
        .update({ full_name: fullName, role: input.role, site_id: siteId })
        .eq("id", userId);
      if (profileError) throw profileError;

      const { error: membershipError } = await admin
        .from("org_users")
        .update({ role: input.role, assigned_locations: assignedLocations })
        .eq("org_id", orgId)
        .eq("user_id", userId);
      if (membershipError) throw membershipError;

      const { error: authError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: fullName },
      });
      if (authError) console.warn("[admin] could not update auth metadata:", authError);
    }

    revalidatePath("/admin");
    return {
      ok: true,
      data: {
        id: userId,
        email: "",
        fullName,
        role: input.role,
        siteId,
        assignedLocations,
        createdAt: "",
      },
    };
  } catch (err) {
    console.error("[admin] updateAdminUser failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not update this member.") };
  }
}

export async function removeAdminUser(userId: string): Promise<AdminResult<null>> {
  try {
    const current = await requireRole(["owner"]);
    if (userId === current.id) {
      return { ok: false, error: "You cannot remove your own account." };
    }

    const orgId = await getCurrentOrgId();
    const membership = await getMembership(orgId, userId);
    if (!membership) {
      return { ok: false, error: "This user is not a member of your organization." };
    }
    if (membership.role === "owner" && (await countOwners(orgId)) <= 1) {
      return { ok: false, error: "The organization must keep at least one owner." };
    }

    const demoMode = await isDemoMode();
    if (demoMode) {
      const supabase = (await createClient()) as DemoClient;
      await supabase.atomic(["org_users"], () => {
        const rows = getTable("org_users");
        const index = rows.findIndex(
          (row) => row.org_id === orgId && row.user_id === userId
        );
        if (index >= 0) rows.splice(index, 1);
      });
    } else {
      const admin = await getLiveAdmin();
      const { error } = await admin
        .from("org_users")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", userId);
      if (error) throw error;
      // Keep the auth account and profile so audit trails (created_by) stay
      // intact. Access is controlled by the membership row.
    }

    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch (err) {
    console.error("[admin] removeAdminUser failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not remove this member.") };
  }
}
