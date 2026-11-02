"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, AlertTriangle, RefreshCw, Info } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import { fetchSite, fetchSiteStockLevels } from "@/app/actions/siteActions";
import type { Site, StockStatus } from "@/types";

interface StockRow {
  product_id: string;
  quantity: number;
  status: StockStatus;
  product_name: string | null;
  product_category: string | null;
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  async function load() {
    if (!params.id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [s, levels] = await Promise.all([
        fetchSite(params.id as string),
        fetchSiteStockLevels(params.id as string),
      ]);
      setSite(s);
      setStock(levels);
    } catch {
      setLoadError("Could not load site details. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  const stockColumns: {
    key: string;
    header: string;
    render?: (s: StockRow) => React.ReactNode;
  }[] = [
    { key: "product", header: "Product", render: (s) => s.product_name || "-" },
    {
      key: "category",
      header: "Category",
      render: (s) =>
        s.product_category ? <Badge variant="info">{s.product_category}</Badge> : <span className="text-muted">-</span>,
    },
    { key: "quantity", header: "Quantity", render: (s) => Number(s.quantity).toLocaleString() },
    {
      key: "status",
      header: "Status",
      render: (s) => {
        const variant = s.status === "IN_STOCK" ? "success" : s.status === "LOW_STOCK" ? "warning" : "danger";
        return <Badge variant={variant}>{s.status}</Badge>;
      },
    },
  ];

  if (loading) return <Spinner />;

  if (loadError || !site) {
    return (
      <div>
        <PageHeader title="Site" description="Site details" />
        <div className="flex flex-col items-center justify-center py-24">
          <AlertTriangle size={40} className="text-warning mb-4" />
          <h2 className="text-lg font-semibold text-foreground">
            {loadError ? "Site unavailable" : "Site not found"}
          </h2>
          <p className="text-sm text-muted mt-1 mb-6 max-w-sm text-center">
            {loadError || "The site you are looking for could not be found."}
          </p>
          {loadError ? (
            <Button variant="secondary" onClick={load}>
              <RefreshCw size={14} /> Retry
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => router.push("/sites")}>
              Back to Sites
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={site.name}
        description={
          [site.address, site.contact_person].filter(Boolean).join(" \u00b7 ") || "Site details"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowInfo(true)}
              title="Site details"
              aria-label="Site details"
            >
              <Info size={16} />
            </Button>
            <Button variant="secondary" onClick={() => router.push("/sites")}>
              <ArrowLeft size={16} /> Back
            </Button>
          </div>
        }
      />

      <Card>
        <CardTitle>Stock at Site</CardTitle>
        <CardContent className="mt-4">
          {stock.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No stock yet"
              description="Stock will appear here once goods are dispatched to this site."
            />
          ) : (
            <Table columns={stockColumns} data={stock} />
          )}
        </CardContent>
      </Card>

      <Modal open={showInfo} onClose={() => setShowInfo(false)} title="Site Details" size="sm">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted">Type</span>
            <Badge variant="info">{site.site_type}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Address</span>
            <span className="text-sm font-medium text-right">{site.address || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Contact Person</span>
            <span className="text-sm font-medium">{site.contact_person || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Status</span>
            <Badge variant={site.is_active ? "success" : "danger"}>
              {site.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </Modal>
    </div>
  );
}