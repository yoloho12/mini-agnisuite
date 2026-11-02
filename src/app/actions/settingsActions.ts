"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgId, getCurrentUser, requireRole, type CurrentUser } from "@/lib/auth";
import { friendlyErrorMessage } from "@/lib/errors";
import type { Organization, UserRole } from "@/types";

export type SettingsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Server action so client pages can resolve the signed-in user (site + signature). */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  return await getCurrentUser();
}

export async function fetchOrganization(): Promise<SettingsResult<Organization | null>> {
  try {
    const orgId = await getCurrentOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, data: (data as Organization) ?? null };
  } catch (err) {
    console.error("[settings] fetchOrganization failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not load organization settings.") };
  }
}

export async function updateOrganization(updates: {
  name: string;
  base_currency: Organization["base_currency"];
  usd_rate: number;
}): Promise<SettingsResult<Organization>> {
  try {
    await requireRole(["owner"]);
    const name = updates.name.trim();
    if (!name) return { ok: false, error: "Organization name is required." };
    const usd_rate = Number(updates.usd_rate);
    if (!Number.isFinite(usd_rate) || usd_rate <= 0) {
      return { ok: false, error: "USD exchange rate must be a positive number." };
    }

    const orgId = await getCurrentOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .update({ name, base_currency: updates.base_currency, usd_rate })
      .eq("id", orgId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "Organization not found." };

    revalidatePath("/settings");
    return { ok: true, data: data as Organization };
  } catch (err) {
    console.error("[settings] updateOrganization failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not save organization settings.") };
  }
}

export interface AccountInfo {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  siteId: string | null;
  signature: string | null;
  assignedLocations: string[];
}

export async function fetchAccount(): Promise<SettingsResult<AccountInfo>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { ok: false, error: "You are not signed in." };
    return {
      ok: true,
      data: {
        id: currentUser.id,
        email: currentUser.email,
        fullName: currentUser.full_name,
        role: currentUser.role,
        siteId: currentUser.site_id,
        signature: currentUser.signature,
        assignedLocations: currentUser.assigned_locations,
      },
    };
  } catch (err) {
    console.error("[settings] fetchAccount failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not load account details.") };
  }
}

export async function updateAccount(updates: {
  fullName?: string;
  signature?: string | null;
}): Promise<SettingsResult<AccountInfo>> {
  try {
    const payload: Record<string, unknown> = {};
    if (updates.fullName !== undefined) {
      const name = updates.fullName.trim();
      if (!name) return { ok: false, error: "Full name is required." };
      payload.full_name = name;
    }
    if (updates.signature !== undefined) payload.signature = updates.signature;
    if (Object.keys(payload).length === 0) {
      return { ok: false, error: "Nothing to save." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return { ok: false, error: "You are not signed in." };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", currentUser.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "Profile not found." };

    revalidatePath("/settings");
    return {
      ok: true,
      data: {
        id: currentUser.id,
        email: currentUser.email,
        fullName: (data.full_name as string) ?? "",
        role: currentUser.role,
        siteId: (data.site_id as string | null) ?? null,
        signature: (data.signature as string | null) ?? null,
        assignedLocations: currentUser.assigned_locations,
      },
    };
  } catch (err) {
    console.error("[settings] updateAccount failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not save your profile.") };
  }
}
