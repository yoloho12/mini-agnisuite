"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Undo2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchSupplierReturns } from "@/app/actions/supplierReturnActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreateSupplierReturn } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { SupplierReturn } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  RETURNED: "info",
  ACKNOWLEDGED: "success",
};

export default function ReturnsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canCreate = canCreateSupplierReturn(user?.role);
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchSupplierReturns();
      setReturns(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const { page, setPage, totalPages, pageItems } = usePagination(returns);

  const columns = [
    { key: "return_number", header: "Return No" },
    { key: "reason", header: "Reason" },
    {
      key: "status",
      header: "Status",
      render: (r: SupplierReturn) => (
        <Badge variant={statusVariant[r.status] || "default"}>{r.status}</Badge>
      ),
    },
    { key: "created_at", header: "Date", render: (r: SupplierReturn) => formatDate(r.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Returns to Supplier"
        description="Return goods back to suppliers"
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/returns/new")}>
              <Plus size={16} /> New Return
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load returns.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : returns.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title="No supplier returns"
          description="Return goods to suppliers when items are defective or no longer needed."
          action={canCreate ? { label: "New Return", onClick: () => router.push("/returns/new") } : undefined}
        />
      ) : (
        <>
          <Table columns={columns} data={pageItems} />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Supplier returns pagination"
          />
        </>
      )}
    </div>
  );
}
