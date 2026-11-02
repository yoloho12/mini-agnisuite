"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import RoleGuard from "@/components/layout/RoleGuard";
import CurrentUserProvider from "@/components/providers/CurrentUserProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <CurrentUserProvider>
      <div className="app-shell flex h-screen overflow-hidden">
        <Sidebar className={`no-print ${sidebarOpen ? "md:translate-x-0 -translate-x-full" : ""}`} />
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="no-print fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <div className="app-column flex flex-col flex-1 overflow-hidden">
          <div className="no-print">
            <Topbar
              showMobileMenuButton
              onMobileMenuToggle={() => setSidebarOpen(!sidebarOpen)}
              sidebarOpen={sidebarOpen}
            />
          </div>
          <main className="app-main flex-1 overflow-y-auto p-4 md:p-6">
            <RoleGuard>{children}</RoleGuard>
          </main>
        </div>
      </div>
    </CurrentUserProvider>
  );
}
