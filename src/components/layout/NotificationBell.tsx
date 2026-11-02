"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMyNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notificationActions";
import type { UserNotification } from "@/types";
import { cn } from "@/lib/utils";
import Spinner from "@/components/ui/Spinner";

const MAX_VISIBLE = 10;

/** Compact relative timestamp for the dropdown (full date for older items). */
function notificationTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Topbar notification bell. The icon is the only notification surface:
 * it opens a panel with the latest notifications, and selecting one marks it
 * read and navigates straight to the related page.
 */
export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Keep the badge fresh across navigation, polling, and explicit updates.
  useEffect(() => {
    let active = true;
    const refreshUnreadCount = () => {
      fetchUnreadNotificationCount()
        .then((count) => {
          if (active) setUnreadCount(count);
        })
        .catch(() => {
          if (active) setUnreadCount(0);
        });
    };
    const handleNotificationUpdate = () => refreshUnreadCount();
    refreshUnreadCount();
    window.addEventListener("notifications:updated", handleNotificationUpdate);
    const intervalId = window.setInterval(refreshUnreadCount, 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("notifications:updated", handleNotificationUpdate);
    };
  }, [pathname]);

  // Close when clicking anywhere outside the bell/panel.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchMyNotifications();
      setNotifications(data.slice(0, MAX_VISIBLE));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) void loadNotifications();
  }

  async function openNotification(notification: UserNotification) {
    setOpen(false);
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id);
        const readAt = new Date().toISOString();
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, read_at: readAt } : item))
        );
        setUnreadCount((count) => Math.max(0, count - 1));
        window.dispatchEvent(new Event("notifications:updated"));
      } catch {
        toast.error("Could not mark notification as read.");
      }
    }
    // Navigate to the related record (dispatch, PO, etc.).
    router.push(notification.href);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at ?? readAt }))
      );
      setUnreadCount(0);
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update notifications.");
    } finally {
      setMarkingAll(false);
    }
  }

  const hasUnread = unreadCount > 0;

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
        className="relative flex p-2 rounded-lg text-muted transition-colors hover:bg-card-hover hover:text-foreground"
      >
        <Bell size={18} />
        {hasUnread && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed left-2 right-2 top-16 z-50 flex max-h-[calc(100vh-5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="mt-0.5 text-xs text-muted">
                {hasUnread ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
            {hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <Spinner className="py-8" />
            ) : loadError ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted">Could not load notifications.</p>
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Inbox size={28} className="mx-auto mb-2 text-muted" />
                <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-muted">
                  Messages about dispatch handoffs will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-card-hover",
                      !notification.read_at && "bg-primary/5"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        notification.read_at
                          ? "bg-card-hover text-muted"
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      <Bell size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {notification.title}
                        </span>
                        {!notification.read_at && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-foreground-dim">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted">
                        {notificationTime(notification.created_at)}
                      </span>
                    </span>
                    <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block shrink-0 border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary transition-colors hover:bg-card-hover"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
