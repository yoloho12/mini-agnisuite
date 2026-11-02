"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCcw, Search } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchSiteReturns } from "@/app/actions/siteReturnActions";
import { formatDate } from "@/lib/utils";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreateSiteReturn } from "@/lib/permissions";
import type { SiteReturn } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "info"> = {
  DRAFT: "default",
  RETURNED: "info",
  ACKNOWLEDGED: "success",
};

export default function SiteReturnsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canCreate = canCreateSiteReturn(user?.role);
  const [returns, setReturns] = useState<SiteReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchSiteReturns();
      setReturns(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return returns;
    return returns.filter(
      (r) => r.return_number.toLowerCase().includes(q) || r.sender_name.toLowerCase().includes(q)
    );
  }, [returns, search]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const columns = [
    { key: "return_number", header: "Return No" },
    { key: "sender_name", header: "Sender" },
    {
      key: "status",
      header: "Status",
      render: (r: SiteReturn) => <Badge variant={statusVariant[r.status] || "default"}>{r.status}</Badge>,
    },
    { key: "created_at", header: "Date", render: (r: SiteReturn) => formatDate(r.created_at) },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Site Returns" description="Return goods from sites back to warehouses" />
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Site Returns" description="Return goods from sites back to warehouses" />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load site returns.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Site Returns"
        description="Return goods from sites back to warehouses"
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/site-returns/new")}>
              <Plus size={16} /> New Return
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by return number or sender..."
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={RefreshCcw}
          title="No site returns"
          description="Return goods from a site back to a warehouse."
          action={canCreate ? { label: "New Return", onClick: () => router.push("/site-returns/new") } : undefined}
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={pageItems}
            onRowClick={(r) => router.push(`/site-returns/${(r as SiteReturn).id}`)}
            emptyMessage="No returns match your search"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Site returns pagination"
          />
        </>
      )}
    </div>
  );
}
