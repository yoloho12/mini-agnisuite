"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, ShoppingCart, Warehouse, MapPin, Users, Truck, FileText } from "lucide-react";
import { fetchProducts } from "@/app/actions/productActions";
import { fetchPurchaseOrders } from "@/app/actions/poActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSites } from "@/app/actions/siteActions";
import { fetchContacts } from "@/app/actions/contactActions";
import { fetchDispatches } from "@/app/actions/dispatchActions";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: string;
  label: string;
  sublabel: string;
  href: string;
}

const TYPE_ICONS: Record<string, typeof Package> = {
  Product: Package,
  "Purchase Order": ShoppingCart,
  Warehouse: Warehouse,
  Site: MapPin,
  Contact: Users,
  Dispatch: Truck,
};

const MAX_PER_TYPE = 4;

/**
 * Global search box for the topbar. Queries products, purchase orders,
 * warehouses, sites, contacts, and dispatches in parallel (debounced),
 * shows a keyboard-navigable dropdown, and routes to the selected entity.
 */
export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  // Close on outside click.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const term = q.trim().toLowerCase();
      const [products, pos, warehouses, sites, contacts, dispatches] = await Promise.all([
        fetchProducts().catch(() => []),
        fetchPurchaseOrders().catch(() => []),
        fetchWarehouses().catch(() => []),
        fetchSites().catch(() => []),
        fetchContacts().catch(() => []),
        fetchDispatches().catch(() => []),
      ]);
      if (requestId !== requestIdRef.current) return; // stale response

      const found: SearchResult[] = [];
      const matches = (...fields: (string | null | undefined)[]) =>
        fields.some((f) => (f ?? "").toLowerCase().includes(term));

      for (const p of products) {
        if (matches(p.name, p.sku, p.brand, p.model, p.category)) {
          found.push({ id: p.id, type: "Product", label: p.name, sublabel: p.sku || p.category || "", href: `/products/${p.id}` });
          if (found.filter((r) => r.type === "Product").length >= MAX_PER_TYPE) break;
        }
      }
      for (const po of pos) {
        if (matches(po.po_number, po.status)) {
          found.push({ id: po.id, type: "Purchase Order", label: po.po_number, sublabel: po.status, href: `/purchase-orders/${po.id}` });
          if (found.filter((r) => r.type === "Purchase Order").length >= MAX_PER_TYPE) break;
        }
      }
      for (const w of warehouses) {
        if (matches(w.name, w.address)) {
          found.push({ id: w.id, type: "Warehouse", label: w.name, sublabel: w.address || "", href: `/warehouses/${w.id}` });
          if (found.filter((r) => r.type === "Warehouse").length >= MAX_PER_TYPE) break;
        }
      }
      for (const s of sites) {
        if (matches(s.name)) {
          found.push({ id: s.id, type: "Site", label: s.name, sublabel: "", href: `/sites/${s.id}` });
          if (found.filter((r) => r.type === "Site").length >= MAX_PER_TYPE) break;
        }
      }
      for (const c of contacts) {
        if (matches(c.name, c.phone, c.email)) {
          found.push({ id: c.id, type: "Contact", label: c.name, sublabel: c.phone || c.email || c.type, href: `/contacts/${c.id}` });
          if (found.filter((r) => r.type === "Contact").length >= MAX_PER_TYPE) break;
        }
      }
      for (const d of dispatches) {
        if (matches(d.dispatch_number, d.receiver_name)) {
          found.push({ id: d.id, type: "Dispatch", label: d.dispatch_number, sublabel: d.receiver_name || "", href: `/dispatches/${d.id}` });
          if (found.filter((r) => r.type === "Dispatch").length >= MAX_PER_TYPE) break;
        }
      }

      setResults(found);
      setActiveIndex(found.length > 0 ? 0 : -1);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Debounce keystrokes. Clearing is handled in onChange to avoid a
  // synchronous setState inside the effect body.
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) return;
    const timer = setTimeout(() => runSearch(q), 250);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  function selectResult(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative hidden md:block max-w-md flex-1">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        placeholder="Search products, orders, locations..."
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          if (v.trim().length === 0) {
            requestIdRef.current++; // drop any in-flight search
            setResults([]);
            setActiveIndex(-1);
            setLoading(false);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
      />

      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50 py-1"
        >
          {loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">Searching…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">No results for “{query.trim()}”</p>
          )}
          {results.map((r, i) => {
            const Icon = TYPE_ICONS[r.type] ?? FileText;
            return (
              <button
                key={`${r.type}-${r.id}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                // Keep focus in the input so keyboard nav survives the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectResult(r)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  i === activeIndex ? "bg-card-hover" : "hover:bg-card-hover"
                )}
              >
                <Icon size={16} className="shrink-0 text-muted" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-foreground truncate">{r.label}</span>
                  {r.sublabel && <span className="block text-xs text-muted truncate">{r.sublabel}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{r.type}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
