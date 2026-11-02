"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShoppingCart } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchPurchaseOrders } from "@/app/actions/poActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreatePurchaseOrder } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { formatMmk } from "@/lib/money";
import type { PurchaseOrder } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  PENDING: "warning",
  PARTIAL: "info",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canCreate = canCreatePurchaseOrder(user?.role);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchaseOrders().then((data) => {
      setPos(data);
      setLoading(false);
    });
  }, []);

  const { page, setPage, totalPages, pageItems } = usePagination(pos);

  const columns = [
    { key: "po_number", header: "PO Number" },
    { key: "status", header: "Status", render: (po: PurchaseOrder) => <Badge variant={statusVariant[po.status] || "default"}>{po.status}</Badge> },
    { key: "total_mmk", header: "Total (MMK)", render: (po: PurchaseOrder) => formatMmk(po.total_mmk) },
    { key: "currency", header: "Currency" },
    { key: "created_at", header: "Date", render: (po: PurchaseOrder) => formatDate(po.created_at) },
  ];

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Track orders from suppliers to warehouses"
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/purchase-orders/new")}>
              <Plus size={16} /> New PO
            </Button>
          ) : undefined
        }
      />

      {pos.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders"
          description="Create your first purchase order to receive goods from suppliers."
          action={canCreate ? { label: "New PO", onClick: () => router.push("/purchase-orders/new") } : undefined}
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={pageItems}
            onRowClick={(po) => router.push(`/purchase-orders/${(po as unknown as PurchaseOrder).id}`)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Purchase orders pagination"
          />
        </>
      )}
    </div>
  );
}
