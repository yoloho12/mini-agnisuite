"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserNotification } from "@/types";

export async function fetchMyNotifications(): Promise<UserNotification[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to view notifications.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .eq("org_id", user.org_id)
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as UserNotification[];
}

export interface NotificationPage {
  notifications: UserNotification[];
  total: number;
  unreadCount: number;
}

/**
 * Paginated notification list for the full "View all" page. Read and unread
 * notifications are returned together, newest first, alongside the total
 * count and the all-time unread count.
 */
export async function fetchMyNotificationPage(
  page: number,
  pageSize: number
): Promise<NotificationPage> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to view notifications.");

  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.max(1, Math.min(100, Math.floor(pageSize) || 10));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  const supabase = await createClient();
  const [pageResult, unreadResult] = await Promise.all([
    supabase
      .from("user_notifications")
      .select("*", { count: "exact" })
      .eq("org_id", user.org_id)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.org_id)
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  if (pageResult.error) throw pageResult.error;
  if (unreadResult.error) throw unreadResult.error;

  return {
    notifications: (pageResult.data ?? []) as UserNotification[],
    total: pageResult.count ?? 0,
    unreadCount: unreadResult.count ?? 0,
  };
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("org_id", user.org_id)
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to update notifications.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("org_id", user.org_id)
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to update notifications.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("org_id", user.org_id)
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) throw error;
}
