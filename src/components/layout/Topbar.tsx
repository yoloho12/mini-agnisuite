"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, LogOut, ChevronDown, Menu, X } from "lucide-react";
import { DEFAULT_DEV_ORG_ID, DEV_ACCOUNTS, DEV_ROLE_LABELS, type DevAccount } from "@/lib/demo/devAccounts";
import Breadcrumbs from "./Breadcrumbs";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "./NotificationBell";

interface TopbarProps {
  title?: string;
  showMobileMenuButton?: boolean;
  onMobileMenuToggle?: () => void;
  sidebarOpen?: boolean;
}

export default function Topbar({ 
  title, 
  showMobileMenuButton = true,
  onMobileMenuToggle,
  sidebarOpen = false
}: TopbarProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [userName, setUserName] = useState("");
  const [devAccountId, setDevAccountId] = useState("");
  const [devRole, setDevRole] = useState("");
  const [devAccounts, setDevAccounts] = useState<DevAccount[]>([...DEV_ACCOUNTS]);
  const menuRef = useRef<HTMLDivElement>(null);

  // Env flag is inlined at build time — reliable where document.cookie is not.
  const isDevBypass = process.env.NEXT_PUBLIC_DEV_BYPASS === "true";

  const refreshDevAccounts = useCallback(async (currentId: string) => {
    try {
      // Pull the account directory from the local demo store so accounts
      // created in the admin panel appear in the switcher immediately.
      const response = await fetch("/api/dev-accounts");
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data?.accounts)
        ? (data.accounts as DevAccount[])
        : null;
      if (!list || list.length === 0) return;
      setDevAccounts(list);
      const fresh = list.find((account) => account.id === currentId);
      if (fresh) {
        setUserName(fresh.full_name || fresh.email || "Dev User");
        setDevRole(fresh.role);
      } else {
        // The account was removed from the organization.
        setDevRole("viewer");
      }
    } catch {
      // Keep the static fallback list.
    }
  }, []);

  useEffect(() => {
    if (isDevBypass) {
      let currentId = "dev-user-000";
      const match = document.cookie.match(/dev-bypass-user=([^;]+)/);
      if (match) {
        try {
          const user = JSON.parse(decodeURIComponent(match[1]));
          currentId = user.id || "dev-user-000";
          setUserName(user.full_name || user.email || "Dev User");
          setDevAccountId(currentId);
          setDevRole(user.role || "owner");
        } catch {
          setUserName("Dev User");
          setDevAccountId(currentId);
          setDevRole("owner");
        }
      } else {
        setUserName("Dev User");
        setDevAccountId(currentId);
        setDevRole("owner");
      }

      void refreshDevAccounts(currentId);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.full_name) {
        setUserName(data.user.user_metadata.full_name);
      } else if (data.user?.email) {
        setUserName(data.user.email);
      }
    });
  }, [isDevBypass, refreshDevAccounts]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    if (isDevBypass) {
      document.cookie = "dev-bypass-user=; Max-Age=0; path=/";
    } else {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  function toggleMenu() {
    const next = !showMenu;
    setShowMenu(next);
    // Refresh the directory whenever the menu opens so members created or
    // removed in the admin panel show up without a full page reload.
    if (next && isDevBypass) {
      void refreshDevAccounts(devAccountId || "dev-user-000");
    }
  }

  async function switchDevAccount(userId: string) {
    const response = await fetch("/api/dev-bypass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) return;
    const { user } = await response.json();
    setShowMenu(false);
    setUserName(user.full_name);
    setDevAccountId(user.id);
    setDevRole(user.role);
    window.location.reload();
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {showMobileMenuButton && onMobileMenuToggle && (
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 rounded-lg hover:bg-card-hover text-muted hover:text-foreground transition-colors"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          {title && <h1 className="text-xl font-semibold text-foreground hidden sm:block">{title}</h1>}
        </div>

        <div className="flex items-center gap-3 flex-1">
          <GlobalSearch />

          <NotificationBell />

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={toggleMenu}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-card-hover transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {initials || <User size={16} />}
              </div>
              {userName && (
                <span className="text-sm text-foreground-dim hidden lg:block max-w-[120px] truncate">
                  {userName}
                </span>
              )}
              <ChevronDown size={14} className="text-muted hidden lg:block" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-50 py-1">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">{userName || "User"}</p>
                  <p className="text-xs text-muted truncate mt-0.5">
                    {isDevBypass ? `${DEV_ROLE_LABELS[devRole as keyof typeof DEV_ROLE_LABELS] || devRole} · Demo account` : "Account"}
                  </p>
                </div>
                {isDevBypass && (
                  <div className="max-h-64 overflow-y-auto border-b border-border py-2">
                    <p className="px-4 pb-1 text-[10px] font-semibold uppercase text-muted">Switch test account</p>
                    {devAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        disabled={account.id === devAccountId}
                        onClick={() => switchDevAccount(account.id)}
                        className="w-full px-4 py-2 text-left text-xs text-foreground-dim hover:bg-card-hover disabled:font-semibold disabled:text-primary"
                      >
                        {account.full_name || account.email} · {DEV_ROLE_LABELS[account.role]}
                        {account.org_id !== DEFAULT_DEV_ORG_ID ? " · Separate org" : ""}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Breadcrumbs - shown on all pages except dashboard */}
      <Breadcrumbs />
    </>
  );
}
