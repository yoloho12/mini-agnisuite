import { createClient, createPrivilegedClient } from "@/lib/supabase/server";
import type { UserNotificationType } from "@/types";

interface NotificationPayload {
  orgId: string;
  actorId: string;
  recipientIds: string[];
  type: UserNotificationType;
  title: string;
  message: string;
  href: string;
}

async function insertNotifications(payload: NotificationPayload): Promise<void> {
  const recipientIds = [...new Set(payload.recipientIds)].filter((id) => id && id !== payload.actorId);
  if (recipientIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("user_notifications").insert(
    recipientIds.map((recipientId) => ({
      org_id: payload.orgId,
      recipient_id: recipientId,
      actor_id: payload.actorId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      href: payload.href,
      read_at: null,
    }))
  );
  if (error) throw error;
}

export async function notifySiteStaffOfDispatch(input: {
  orgId: string;
  actorId: string;
  actorName: string;
  siteId: string;
  dispatchId: string;
  dispatchNumber: string;
  siteName: string;
}) {
  const membershipClient =
    process.env.NEXT_PUBLIC_DEV_BYPASS === "true"
      ? await createClient()
      : await createPrivilegedClient();
  const { data: memberships, error: membershipError } = await membershipClient
    .from("org_users")
    .select("user_id, assigned_locations")
    .eq("org_id", input.orgId)
    .eq("role", "staff_site");
  if (membershipError) throw membershipError;

  const memberLocations = (memberships ?? []).filter((membership) => {
    const assigned = Array.isArray(membership.assigned_locations) ? membership.assigned_locations : [];
    return assigned.some((location: unknown) => {
      if (typeof location === "string") return location === input.siteId;
      if (location && typeof location === "object" && "id" in location) {
        return String(location.id) === input.siteId;
      }
      return false;
    });
  });
  const userIds = [...new Set((memberships ?? []).map((membership) => String(membership.user_id)))];
  if (userIds.length === 0) return;

  const supabase = await createClient();
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("site_id", input.siteId)
    .in("id", userIds);
  if (profileError) throw profileError;

  const recipientIds = new Set((profiles ?? []).map((profile) => String(profile.id)));
  for (const membership of memberLocations) recipientIds.add(String(membership.user_id));

  await insertNotifications({
    orgId: input.orgId,
    actorId: input.actorId,
    recipientIds: [...recipientIds],
    type: "DISPATCH_CREATED",
    title: "Incoming dispatch",
    message: `${input.dispatchNumber} was dispatched to ${input.siteName} by ${input.actorName}. Please review and acknowledge receipt.`,
    href: `/dispatches/${input.dispatchId}`,
  });
}

export async function notifyDispatcherOfAcknowledgement(input: {
  orgId: string;
  actorId: string;
  actorName: string;
  dispatcherId: string;
  dispatchId: string;
  dispatchNumber: string;
  receiverName: string;
}) {
  await insertNotifications({
    orgId: input.orgId,
    actorId: input.actorId,
    recipientIds: [input.dispatcherId],
    type: "DISPATCH_ACKNOWLEDGED",
    title: "Dispatch acknowledged",
    message: `${input.dispatchNumber} was received by ${input.receiverName} and acknowledged by ${input.actorName}.`,
    href: `/dispatches/${input.dispatchId}`,
  });
}
