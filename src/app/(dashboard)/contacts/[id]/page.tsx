"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Undo2, Wallet, Receipt } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchContact } from "@/app/actions/contactActions";
import { fetchPurchaseOrders } from "@/app/actions/poActions";
import { fetchSupplierReturns } from "@/app/actions/supplierReturnActions";
import { formatDate } from "@/lib/utils";
import { formatMmk } from "@/lib/money";
import type { Contact, PurchaseOrder, SupplierReturn } from "@/types";

const poStatusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  PENDING: "warning",
  PARTIAL: "info",
  RECEIVED: "success",
  CANCELLED: "danger",
};

const returnStatusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  RETURNED: "info",
  ACKNOWLEDGED: "success",
};

export default function ContactLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const id = params.id as string;
      const [c, allPos, allReturns] = await Promise.all([
        fetchContact(id),
        fetchPurchaseOrders(),
        fetchSupplierReturns(),
      ]);
      setContact(c);
      setPos(allPos.filter((p) => p.supplier_id === id));
      setReturns(allReturns.filter((r) => r.supplier_id === id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) load();
  }, [params.id]);

  if (loading) return <Spinner />;

  if (error || !contact) {
    return (
      <div>
        <PageHeader title="Supplier Ledger" description="Contact not found" />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load supplier ledger.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      </div>
    );
  }

  const totalSpent = pos.reduce((sum, p) => sum + Number(p.total_mmk || 0), 0);
  const activeReturns = returns.filter((r) => r.status !== "ACKNOWLEDGED").length;

  const poColumns = [
    { key: "po_number", header: "PO Number" },
    {
      key: "status",
      header: "Status",
      render: (po: PurchaseOrder) => <Badge variant={poStatusVariant[po.status] || "default"}>{po.status}</Badge>,
    },
    {
      key: "total_mmk",
      header: "Total",
      render: (po: PurchaseOrder) => formatMmk(Number(po.total_mmk)),
    },
    { key: "created_at", header: "Date", render: (po: PurchaseOrder) => formatDate(po.created_at) },
  ];

  const returnColumns = [
    { key: "return_number", header: "Return No" },
    { key: "reason", header: "Reason" },
    {
      key: "status",
      header: "Status",
      render: (r: SupplierReturn) => <Badge variant={returnStatusVariant[r.status] || "default"}>{r.status}</Badge>,
    },
    { key: "created_at", header: "Date", render: (r: SupplierReturn) => formatDate(r.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title={contact.name}
        description={`Supplier Ledger — ${contact.phone || "-"} · ${contact.email || "-"}`}
        actions={
          <Button variant="secondary" onClick={() => router.push("/contacts")}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/15 p-2.5">
                <ShoppingCart size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted">Total POs</p>
                <p className="text-2xl font-bold text-foreground">{pos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/15 p-2.5">
                <Wallet size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted">Total Spent</p>
                <p className="text-2xl font-bold text-foreground">{formatMmk(totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-danger/15 p-2.5">
                <Undo2 size={18} className="text-danger" />
              </div>
              <div>
                <p className="text-sm text-muted">Active Returns</p>
                <p className="text-2xl font-bold text-foreground">{activeReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt size={18} className="text-primary" />
          <CardTitle>Purchase Orders</CardTitle>
        </div>
        <CardContent>
          {pos.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No purchase orders"
              description="No POs have been placed with this supplier yet."
            />
          ) : (
            <Table
              columns={poColumns}
              data={pos}
              onRowClick={(po) => router.push(`/purchase-orders/${(po as unknown as PurchaseOrder).id}`)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Undo2 size={18} className="text-danger" />
          <CardTitle>Returns</CardTitle>
        </div>
        <CardContent>
          {returns.length === 0 ? (
            <EmptyState
              icon={Undo2}
              title="No returns"
              description="No return vouchers exist for this supplier yet."
            />
          ) : (
            <Table columns={returnColumns} data={returns} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}