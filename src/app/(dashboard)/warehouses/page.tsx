"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Warehouse, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchWarehouses, addWarehouse, removeWarehouse } from "@/app/actions/warehouseActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canManageMasterData } from "@/lib/permissions";
import type { Warehouse as WarehouseRow } from "@/types";

export default function WarehousesPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManage = canManageMasterData(user?.role);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function loadWarehouses() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchWarehouses();
      setWarehouses(data);
    } catch {
      setLoadError("Could not load warehouses. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function handleDelete(warehouse: WarehouseRow) {
    if (!confirm("Delete this warehouse?")) return;
    try {
      await removeWarehouse(warehouse.id);
      setWarehouses((prev) => prev.filter((w) => w.id !== warehouse.id));
      toast.success("Warehouse deleted");
    } catch (err) {
      toast.error("Failed to delete warehouse", {
        description: friendlyErrorMessage(err, "An unexpected error occurred."),
      });
    }
  }

  const filtered = warehouses.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.address ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const columns: {
    key: string;
    header: string;
    render?: (w: WarehouseRow) => React.ReactNode;
    className?: string;
  }[] = [
    { key: "name", header: "Name" },
    { key: "address", header: "Address", render: (w) => w.address || "-" },
    { key: "contact_person", header: "Contact Person", render: (w) => w.contact_person || "-" },
    {
      key: "is_active",
      header: "Status",
      render: (w) => (
        <Badge variant={w.is_active ? "success" : "danger"}>
          {w.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-20",
      render: (w) => (
        <div className="flex items-center gap-1">
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(w);
              }}
              className="p-1.5 rounded hover:bg-danger/10 text-muted hover:text-danger"
              title="Delete warehouse"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <Spinner />;

  if (loadError) {
    return (
      <div>
        <PageHeader title="Warehouses" description="Manage your central stock holding locations" />
        <div className="flex flex-col items-center justify-center py-24">
          <AlertTriangle size={40} className="text-warning mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Warehouses unavailable</h2>
          <p className="text-sm text-muted mt-1 mb-6 max-w-sm text-center">{loadError}</p>
          <Button variant="secondary" onClick={loadWarehouses}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Warehouses"
        description="Manage your central stock holding locations"
        actions={
          canManage ? (
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Warehouse
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by name or address..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          iconLeft={<Search size={16} />}
          wrapperClassName="max-w-sm"
        />
      </div>

      {warehouses.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No warehouses yet"
          description="Create your first warehouse to start receiving goods."
          action={canManage ? { label: "Add Warehouse", onClick: () => setShowAdd(true) } : undefined}
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={pageItems}
            onRowClick={(w) => router.push(`/warehouses/${w.id}`)}
            emptyMessage="No warehouses match your search"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Warehouses pagination"
          />
        </>
      )}

      {canManage && (
        <AddWarehouseModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={loadWarehouses} />
      )}
    </div>
  );
}

function AddWarehouseModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", address: "", contact_person: "", is_active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await addWarehouse({
        name: form.name.trim(),
        address: form.address || null,
        contact_person: form.contact_person || null,
        is_active: form.is_active,
      });
      toast.success("Warehouse created");
      onCreated();
      onClose();
      setForm({ name: "", address: "", contact_person: "", is_active: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create warehouse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Warehouse">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="e.g. Main Warehouse"
        />
        <Input
          label="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Input
          label="Contact Person"
          value={form.contact_person}
          onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-4 w-4 rounded border-border bg-card accent-primary"
          />
          <span className="text-sm text-foreground">Active</span>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!form.name.trim()}>
            Create Warehouse
          </Button>
        </div>
      </form>
    </Modal>
  );
}