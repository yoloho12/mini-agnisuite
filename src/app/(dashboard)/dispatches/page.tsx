"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Truck, Search } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchDispatches } from "@/app/actions/dispatchActions";
import { formatDate } from "@/lib/utils";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreateDispatch } from "@/lib/permissions";
import type { Dispatch } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "info"> = {
  DRAFT: "default",
  DISPATCHED: "info",
  ACKNOWLEDGED: "success",
};

export default function DispatchesPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canCreate = canCreateDispatch(user?.role);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchDispatches();
      setDispatches(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Site staff can only open dispatches addressed to their own site (enforced
  // by fetchDispatch), so keep the list consistent with that rule.
  const scoped =
    user?.role === "staff_site" && user.siteId
      ? dispatches.filter((d) => d.to_site_id === user.siteId)
      : dispatches;

  const filtered = scoped.filter(
    (d) =>
      d.dispatch_number.toLowerCase().includes(search.toLowerCase()) ||
      (d.receiver_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const columns = [
    { key: "dispatch_number", header: "Dispatch No" },
    {
      key: "status",
      header: "Status",
      render: (d: Dispatch) => <Badge variant={statusVariant[d.status] || "default"}>{d.status}</Badge>,
    },
    { key: "receiver_name", header: "Receiver" },
    { key: "dispatched_at", header: "Date", render: (d: Dispatch) => formatDate(d.dispatched_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Dispatches"
        description="Track goods dispatched from warehouses to sites"
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/dispatches/new")}>
              <Plus size={16} /> New Dispatch
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load dispatches.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : dispatches.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No dispatches yet"
          description="Check goods out from a warehouse to a site."
          action={canCreate ? { label: "New Dispatch", onClick: () => router.push("/dispatches/new") } : undefined}
        />
      ) : (
        <>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search by dispatch no or receiver..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-10 w-full pl-9 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <Table
            columns={columns}
            data={pageItems}
            onRowClick={(d) => router.push(`/dispatches/${(d as unknown as Dispatch).id}`)}
            emptyMessage="No dispatches match your search"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Dispatches pagination"
          />
        </>
      )}
    </div>
  );
}