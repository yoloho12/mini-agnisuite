"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/products": "Products",
  "/products/new": "New Product",
  "/warehouses": "Warehouses",
  "/warehouses/new": "New Warehouse",
  "/sites": "Sites",
  "/sites/new": "New Site",
  "/purchase-orders": "Purchase Orders",
  "/purchase-orders/new": "New Purchase Order",
  "/dispatches": "Dispatches",
  "/dispatches/new": "New Dispatch",
  "/site-returns": "Site Returns",
  "/site-returns/new": "New Site Return",
  "/transfers": "Transfers",
  "/transfers/new": "New Transfer",
  "/returns": "Return to Supplier",
  "/returns/new": "New Supplier Return",
  "/write-offs": "Write-offs",
  "/write-offs/new": "New Write-off",
  "/audits": "Stock Audits",
  "/audits/new": "New Audit",
  "/scanner": "Scanner",
  "/alerts": "Alerts",
  "/notifications": "Notifications",
  "/reports": "Reports",
  "/contacts": "Contacts",
  "/admin": "Admin",
  "/settings": "Settings",
};

function getLabel(href: string): string {
  if (routeLabels[href]) return routeLabels[href];
  // Handle dynamic routes
  for (const [key, label] of Object.entries(routeLabels)) {
    if (href.startsWith(key + "/") && key !== "/") {
      return label;
    }
  }
  return href.split("/").pop() || "";
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string; isLast: boolean }[] = [
    { label: "Dashboard", href: "/", isLast: false },
  ];

  let currentPath = "";
  segments.forEach((segment, i) => {
    currentPath += "/" + segment;
    const isLast = i === segments.length - 1;
    const label = getLabel(currentPath) || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, href: currentPath, isLast });
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 px-4 py-2 text-sm">
      <ol className="flex items-center gap-1 flex-wrap" role="list">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {index > 0 && <ChevronRight size={12} className="text-muted shrink-0" />}
            {crumb.isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}