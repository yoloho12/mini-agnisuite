"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageX } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchWriteOffs } from "@/app/actions/writeOffActions";
import { fetchProducts } from "@/app/actions/productActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreateWriteOff } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { WriteOff, Product } from "@/types";

const reasonVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DAMAGED: "danger",
  EXPIRED: "warning",
  LOST: "info",
  OTHER: "default",
};

export default function WriteOffsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canCreate = canCreateWriteOff(user?.role);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const [w, p] = await Promise.all([fetchWriteOffs(), fetchProducts()]);
      setWriteOffs(w);
      setProducts(p);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const productMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      map[p.id] = p.name;
    }
    return map;
  }, [products]);

  const { page, setPage, totalPages, pageItems } = usePagination(writeOffs);

  const columns = [
    {
      key: "product_id",
      header: "Product",
      render: (w: WriteOff) => productMap[w.product_id] || w.product_id,
    },
    { key: "location_type", header: "Location Type" },
    { key: "quantity", header: "Quantity" },
    {
      key: "reason",
      header: "Reason",
      render: (w: WriteOff) => (
        <Badge variant={reasonVariant[w.reason] || "default"}>{w.reason}</Badge>
      ),
    },
    { key: "created_at", header: "Date", render: (w: WriteOff) => formatDate(w.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Write-offs"
        description="Log damaged, expired, or lost stock"
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/write-offs/new")}>
              <Plus size={16} /> New Write-off
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load write-offs.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : writeOffs.length === 0 ? (
        <EmptyState
          icon={PackageX}
          title="No write-offs"
          description="Log damaged, expired, or lost stock with reasons for audit trail."
          action={canCreate ? { label: "New Write-off", onClick: () => router.push("/write-offs/new") } : undefined}
        />
      ) : (
        <>
          <Table columns={columns} data={pageItems} />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Write-offs pagination"
          />
        </>
      )}
    </div>
  );
}
