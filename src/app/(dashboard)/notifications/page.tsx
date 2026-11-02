"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import {
  fetchMyNotificationPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notificationActions";
import type { UserNotification } from "@/types";

const PAGE_SIZE = 10;

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchPage = useCallback(async (targetPage: number) => {
    const result = await fetchMyNotificationPage(targetPage, PAGE_SIZE);
    setNotifications(result.notifications);
    setTotal(result.total);
    setUnreadCount(result.unreadCount);
    setPage(targetPage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPage(1)
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load notifications.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function loadPage(targetPage: number) {
    setLoading(true);
    try {
      await fetchPage(targetPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function openNotification(notification: UserNotification) {
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        ));
        setUnreadCount((count) => Math.max(0, count - 1));
        window.dispatchEvent(new Event("notifications:updated"));
      } catch {
        toast.error("Could not mark notification as read.");
        return;
      }
    }
    router.push(notification.href);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
      setUnreadCount(0);
      window.dispatchEvent(new Event("notifications:updated"));
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update notifications.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread · ${total} total`}
        actions={unreadCount > 0 ? (
          <Button variant="secondary" onClick={handleMarkAllRead} loading={markingAll}>
            <CheckCheck size={16} /> Mark all read
          </Button>
        ) : undefined}
      />

      {loading ? <Spinner /> : notifications.length === 0 ? (
        <EmptyState icon={Inbox} title="You're all caught up" description="Messages about dispatch handoffs will appear here." />
      ) : (
        <>
          <div className="divide-y divide-border border-y border-border">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={`flex w-full items-start gap-3 px-3 py-4 text-left transition-colors hover:bg-card-hover ${notification.read_at ? "" : "bg-primary/5"}`}
              >
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notification.read_at ? "bg-card-hover text-muted" : "bg-primary/15 text-primary"}`}>
                  <Bell size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{notification.title}</span>
                    {!notification.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </span>
                  <span className="mt-1 block text-sm text-foreground-dim">{notification.message}</span>
                  <span className="mt-1 block text-xs text-muted">{new Date(notification.created_at).toLocaleString()}</span>
                </span>
              </button>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(next) => void loadPage(next)}
            ariaLabel="Notification pagination"
          />
        </>
      )}
    </div>
  );
}
