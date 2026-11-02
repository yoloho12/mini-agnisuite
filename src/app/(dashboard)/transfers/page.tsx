"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeftRight } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchTransfers } from "@/app/actions/transferActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreateTransfer } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { StockTransfer, Warehouse } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  COMPLETED: "success",
  DRAFT: "default",
  CANCELLED: "danger",
};

export default function TransfersPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canCreate = canCreateTransfer(user?.role);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const [data, w] = await Promise.all([fetchTransfers(), fetchWarehouses()]);
      setTransfers(data);
      setWarehouses(w);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const warehouseNames = new Map(warehouses.map((w) => [w.id, w.name]));
  const { page, setPage, totalPages, pageItems } = usePagination(transfers);

  const columns = [
    { key: "transfer_number", header: "Transfer No" },
    {
      key: "from",
      header: "From",
      render: (t: StockTransfer) => warehouseNames.get(t.from_warehouse_id) || "Unknown",
    },
    {
      key: "to",
      header: "To",
      render: (t: StockTransfer) => warehouseNames.get(t.to_warehouse_id) || "Unknown",
    },
    {
      key: "status",
      header: "Status",
      render: (t: StockTransfer) => (
        <Badge variant={statusVariant[t.status] || "default"}>{t.status}</Badge>
      ),
    },
    { key: "created_at", header: "Date", render: (t: StockTransfer) => formatDate(t.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Transfers"
        description="Move stock between warehouses"
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/transfers/new")}>
              <Plus size={16} /> New Transfer
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load transfers.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : transfers.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transfers yet"
          description="Transfer stock between your warehouses."
          action={canCreate ? { label: "New Transfer", onClick: () => router.push("/transfers/new") } : undefined}
        />
      ) : (
        <>
          <Table columns={columns} data={pageItems} />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Transfers pagination"
          />
        </>
      )}
    </div>
  );
}
