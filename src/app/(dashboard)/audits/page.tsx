"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ClipboardCheck } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchAudits } from "@/app/actions/auditActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canCreateAudit } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { Audit } from "@/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  IN_PROGRESS: "warning",
  COMPLETED: "success",
};

export default function AuditsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canCreate = canCreateAudit(user?.role);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchAudits();
      setAudits(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const { page, setPage, totalPages, pageItems } = usePagination(audits);

  const columns = [
    {
      key: "status",
      header: "Status",
      render: (a: Audit) => (
        <Badge variant={statusVariant[a.status] || "default"}>{a.status}</Badge>
      ),
    },
    { key: "location_type", header: "Location Type" },
    { key: "created_at", header: "Created", render: (a: Audit) => formatDate(a.created_at) },
    {
      key: "completed_at",
      header: "Completed",
      render: (a: Audit) => (a.completed_at ? formatDate(a.completed_at) : "-"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Audits"
        description="Physical count sheets and reconciliation"
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/audits/new")}>
              <Plus size={16} /> New Audit
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load audits.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : audits.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No audits yet"
          description="Create stock audit sessions to reconcile physical counts against system quantities."
          action={canCreate ? { label: "New Audit", onClick: () => router.push("/audits/new") } : undefined}
        />
      ) : (
        <>
          <Table columns={columns} data={pageItems} />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Stock audits pagination"
          />
        </>
      )}
    </div>
  );
}
