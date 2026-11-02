"use client";

import { useEffect, useState } from "react";
import { BellOff, AlertTriangle, PackageX } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchLowStockAlerts, type StockAlert } from "@/app/actions/alertActions";
import { usePagination } from "@/hooks/usePagination";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchLowStockAlerts();
      setAlerts(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const lowCount = alerts.filter((a) => a.status === "LOW_STOCK").length;
  const outCount = alerts.filter((a) => a.status === "OUT_OF_STOCK").length;
  const { page, setPage, totalPages, pageItems } = usePagination(alerts);

  const columns = [
    { key: "product_name", header: "Product" },
    { key: "sku", header: "SKU" },
    { key: "location_type", header: "Location Type" },
    { key: "quantity", header: "Quantity" },
    { key: "reorder_point", header: "Reorder Point" },
    {
      key: "status",
      header: "Status",
      render: (a: StockAlert) => (
        <Badge variant={statusVariant[a.status] || "default"}>{a.status}</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Alerts" description="Reorder points and low stock" />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load stock alerts.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="All stock levels healthy"
          description="No products are currently at or below their reorder points."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-accent/15 p-2.5">
                    <AlertTriangle size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted">Low Stock</p>
                    <p className="text-2xl font-bold text-foreground">{lowCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-danger/15 p-2.5">
                    <PackageX size={18} className="text-danger" />
                  </div>
                  <div>
                    <p className="text-sm text-muted">Out of Stock</p>
                    <p className="text-2xl font-bold text-foreground">{outCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Table columns={columns} data={pageItems} emptyMessage="No alerts" />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Alerts pagination"
          />
        </>
      )}
    </div>
  );
}