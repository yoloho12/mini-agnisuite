"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  MapPin,
  ShoppingCart,
  Truck,
  RotateCcw,
  ArrowLeftRight,
  Undo2,
  Trash2,
  ClipboardCheck,
  ScanBarcode,
  Bell,
  FileBarChart,
  Users,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { NAV_ITEMS } from "@/constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canAccessNavItem, hasPermission } from "@/lib/permissions";

const iconMap = {
  LayoutDashboard,
  Package,
  Warehouse,
  MapPin,
  ShoppingCart,
  Truck,
  RotateCcw,
  ArrowLeftRight,
  Undo2,
  Trash2,
  ClipboardCheck,
  ScanBarcode,
  Bell,
  FileBarChart,
  Users,
  Settings,
  ShieldCheck,
} as const;

export default function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useCurrentUser();
  const role = user?.role ?? null;
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Persist collapsed state in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setCollapsed(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && e.metaKey) {
      setCollapsed(true);
    } else if (e.key === "ArrowRight" && e.metaKey) {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "flex flex-col bg-card border-r border-border h-full transition-all duration-300 fixed md:relative z-50",
        collapsed ? "w-16" : "w-64",
        className
      )}
      onKeyDown={(e) => handleKeyDown(e as unknown as KeyboardEvent)}
      tabIndex={0}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-border">
        {!collapsed && (
          <span className="text-lg font-bold text-primary">Mini-AgniSuite</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-card-hover text-muted hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map((item, i) => {
          if ("ownerOnly" in item && item.ownerOnly && role !== "owner") {
            return null;
          }
          if (item.permission && !hasPermission(role, item.permission)) {
            return null;
          }
          if ("divider" in item && item.divider) {
            return collapsed ? (
              <div key={i} className="my-2 mx-2 border-t border-border" />
            ) : (
              <div key={i} className="my-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {item.label}
              </div>
            );
          }

          if (!canAccessNavItem(item.href, role)) {
            return null;
          }

          const href = item.href;
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-foreground-dim hover:text-foreground hover:bg-card-hover"
              )}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {Icon && <Icon size={18} className="shrink-0" />}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-border">
          <div className="text-[10px] text-muted text-center">Mini-AgniSuite v1.0</div>
          <div className="mt-2 text-[10px] text-muted text-center">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px]">⌘</kbd>+<kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px]">←/→</kbd> collapse
          </div>
        </div>
      )}
    </aside>
  );
}
