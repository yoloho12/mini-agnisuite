"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireLocationAccess, requireRole } from "@/lib/auth";
import * as dispatchRepo from "@/repositories/dispatchRepo";
import * as siteRepo from "@/repositories/siteRepo";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import * as productRepo from "@/repositories/productRepo";
import { createClient, createPrivilegedClient } from "@/lib/supabase/server";
import { validateStockMovementPlan } from "@/services/stockMovementService";
import { notifyDispatcherOfAcknowledgement, notifySiteStaffOfDispatch } from "@/services/notificationService";
import { generateDispatchNumber } from "@/lib/numberGen";
import { friendlyErrorMessage } from "@/lib/errors";
import { canAccessLocation } from "@/lib/locationAccess";
import type { Dispatch, DispatchLineItem, LocationType } from "@/types";
import { normalizeAssignedLocations } from "@/lib/locationAccess";

export async function fetchDispatches(orgId?: string) {
  void orgId;
  const user = await getCurrentUser();
  const dispatches = await dispatchRepo.getDispatches(await getCurrentOrgId());
  return dispatches.filter((dispatch) =>
    canAccessLocation(user, "WAREHOUSE", dispatch.from_warehouse_id) &&
    canAccessLocation(user, "SITE", dispatch.to_site_id)
  );
}

export async function fetchDispatch(id: string) {
  const record = await dispatchRepo.getDispatch(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Dispatch");
  const user = await getCurrentUser();
  if (
    !canAccessLocation(user, "WAREHOUSE", record.from_warehouse_id) ||
    !canAccessLocation(user, "SITE", record.to_site_id)
  ) {
    throw new Error("Dispatch not found.");
  }
  return record;
}

export async function addDispatch(
  dispatch: Omit<Dispatch, "id" | "dispatch_number">,
  lineItems: Omit<DispatchLineItem, "id">[]
) {
  const actor = await requireRole(["owner", "manager", "staff_warehouse"]);
  await requireLocationAccess("WAREHOUSE", dispatch.from_warehouse_id);
  await requireLocationAccess("SITE", dispatch.to_site_id);
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await warehouseRepo.getWarehouse(dispatch.from_warehouse_id), orgId, "Warehouse");
  assertOrganizationRecord(await siteRepo.getSite(dispatch.to_site_id), orgId, "Site");
  const senderName = dispatch.sender_name.trim();
  const receiverName = dispatch.receiver_name.trim();
  if (!senderName) throw new Error("Sender name is required.");
  if (!receiverName) throw new Error("Receiver name is required.");
  if (senderName.length > 120 || receiverName.length > 120) {
    throw new Error("Sender and receiver names must be 120 characters or fewer.");
  }
  if (lineItems.length === 0) throw new Error("Add at least one product to dispatch.");
  for (const item of lineItems) {
    assertOrganizationRecord(await productRepo.getProduct(item.product_id), orgId, "Product");
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Dispatch quantities must be positive whole numbers.");
    }
  }
  const movementPlan = lineItems.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    from_location_type: "WAREHOUSE" as const,
    from_location_id: dispatch.from_warehouse_id,
    to_location_type: "SITE" as const,
    to_location_id: dispatch.to_site_id,
    note: "dispatch",
  }));
  const validation = validateStockMovementPlan(movementPlan, await productRepo.getAllStockLevels(orgId));
  if (!validation.ok) throw new Error(validation.reason ?? "Dispatch stock validation failed.");
  const existing = await dispatchRepo.getDispatches(orgId);

  const dispatchRecord: Omit<Dispatch, "id"> = {
    ...dispatch,
    sender_name: senderName,
    receiver_name: receiverName,
    org_id: orgId,
    dispatch_number: generateDispatchNumber(existing.length + 1),
    dispatched_by: actor.id,
    status: "DISPATCHED",
  };

  const supabase = await createClient();
  const rpc = (supabase as typeof supabase & {
    rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
  }).rpc;
  if (typeof rpc !== "function") throw new Error("Atomic dispatch operation is unavailable.");
  const { data, error } = await rpc.call(supabase, "create_dispatch_with_stock_batch", {
    p_dispatch: dispatchRecord,
    p_line_items: lineItems.map(({ product_id, quantity }) => ({ product_id, quantity })),
  });
  if (error) throw error;
  const result = data as Dispatch;
  try {
    const site = await siteRepo.getSite(dispatch.to_site_id);
    await notifySiteStaffOfDispatch({
      orgId,
      actorId: actor.id,
      actorName: actor.full_name,
      siteId: dispatch.to_site_id,
      dispatchId: result.id,
      dispatchNumber: result.dispatch_number,
      siteName: site?.name ?? "your site",
    });
  } catch (error) {
    console.error("[notifications] failed to notify site staff of dispatch", error);
  }
  revalidatePath("/dispatches");
  return result;
}

export async function acknowledgeDispatch(dispatchId: string): Promise<
  { ok: true; data: Dispatch } | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "You must be signed in to acknowledge this dispatch." };
    if (user.role !== "owner" && user.role !== "manager" && user.role !== "staff_site") {
      return { ok: false, error: "Your account does not have permission to acknowledge dispatches." };
    }
    if (!user.signature) {
      return { ok: false, error: "Save your digital signature in Settings first." };
    }

    const dispatch = await dispatchRepo.getDispatch(dispatchId);
    if (!dispatch || dispatch.org_id !== user.org_id) return { ok: false, error: "Dispatch not found." };
    if (
      !canAccessLocation(user, "WAREHOUSE", dispatch.from_warehouse_id) ||
      !canAccessLocation(user, "SITE", dispatch.to_site_id)
    ) {
      return { ok: false, error: "This dispatch is for a different site." };
    }
    if (dispatch.status !== "DISPATCHED") {
      return { ok: false, error: "This dispatch has already been acknowledged." };
    }

    // Sign-off only — stock already moved when the dispatch was created.
    const data = await dispatchRepo.updateDispatch(dispatchId, {
      status: "ACKNOWLEDGED",
      receiver_name: user.full_name,
      receiver_signature: user.signature,
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    });

    if (dispatch.dispatched_by && dispatch.dispatched_by !== user.id) {
      try {
        await notifyDispatcherOfAcknowledgement({
          orgId: user.org_id,
          actorId: user.id,
          actorName: user.full_name,
          dispatcherId: dispatch.dispatched_by,
          dispatchId: dispatch.id,
          dispatchNumber: dispatch.dispatch_number,
          receiverName: user.full_name,
        });
      } catch (error) {
        console.error("[notifications] failed to notify dispatcher of acknowledgement", error);
      }
    }

    revalidatePath("/dispatches");
    revalidatePath(`/dispatches/${dispatchId}`);
    return { ok: true, data };
  } catch (err) {
    console.error("[dispatch] acknowledgeDispatch failed:", err);
    return { ok: false, error: friendlyErrorMessage(err, "Could not acknowledge the dispatch.") };
  }
}

async function fetchPermittedDispatchContacts(
  locationType: LocationType,
  locationId: string
) {
  const user = await getCurrentUser();
  if (!canAccessLocation(user, locationType, locationId)) {
    throw new Error("You are not assigned to this location.");
  }

  const orgId = await getCurrentOrgId();
  const supabase =
    process.env.NEXT_PUBLIC_DEV_BYPASS === "true"
      ? await createClient()
      : await createPrivilegedClient();
  const PERMITTED_ROLES =
    locationType === "WAREHOUSE"
      ? new Set(["owner", "manager", "staff_warehouse"])
      : new Set(["owner", "manager", "staff_warehouse", "staff_site"]);
  const { data: memberships, error } = await supabase
    .from("org_users")
    .select("user_id, role, assigned_locations")
    .eq("org_id", orgId);
  if (error) throw error;
  const rows = (memberships ?? []) as Array<Record<string, unknown>>;
  const permittedIds = rows
    .filter((r) => PERMITTED_ROLES.has(String(r.role)))
    .map((r) => String(r.user_id ?? ""))
    .filter(Boolean);
  if (permittedIds.length === 0) return [];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, site_id")
    .in("id", permittedIds)
    .order("full_name");
  if (profileError) throw profileError;

  return (profiles ?? [])
    .flatMap((profile) => {
      const membership = rows.find((row) => String(row.user_id) === String(profile.id));
      if (!membership) return [];

      const role = String(membership.role ?? "");
      const hasLocationAssignment = normalizeAssignedLocations(
        membership.assigned_locations
      ).includes(locationId);
      const isPrimarySite = locationType === "SITE" && profile.site_id === locationId;
      if (
        role !== "owner" &&
        role !== "manager" &&
        !hasLocationAssignment &&
        !isPrimarySite
      ) {
        return [];
      }

      return [{
        id: String(profile.id),
        full_name: String(profile.full_name ?? ""),
        role,
        site_id: (profile.site_id as string | null) ?? null,
      }];
    })
    .filter((profile) => profile.full_name.trim().length > 0);
}

export async function fetchPermittedReceivers(siteId: string) {
  return fetchPermittedDispatchContacts("SITE", siteId);
}

export async function fetchPermittedDispatchSenders(warehouseId: string) {
  return fetchPermittedDispatchContacts("WAREHOUSE", warehouseId);
}

export async function fetchDispatchLineItems(dispatchId: string) {
  await fetchDispatch(dispatchId);
  return dispatchRepo.getDispatchLineItems(dispatchId);
}
