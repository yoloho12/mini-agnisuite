"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, MapPin, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import { fetchSites, addSite, removeSite } from "@/app/actions/siteActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canManageMasterData } from "@/lib/permissions";
import { SITE_TYPES } from "@/constants";
import type { Site } from "@/types";

export default function SitesPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManage = canManageMasterData(user?.role);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function loadSites() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchSites();
      setSites(data);
    } catch {
      setLoadError("Could not load sites. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  async function handleDelete(site: Site) {
    if (!confirm("Delete this site?")) return;
    try {
      await removeSite(site.id);
      setSites((prev) => prev.filter((s) => s.id !== site.id));
      toast.success("Site deleted");
    } catch (err) {
      toast.error("Failed to delete site", {
        description: friendlyErrorMessage(err, "An unexpected error occurred."),
      });
    }
  }

  const filtered = sites.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const columns: {
    key: string;
    header: string;
    render?: (s: Site) => React.ReactNode;
    className?: string;
  }[] = [
    { key: "name", header: "Name" },
    { key: "site_type", header: "Type", render: (s) => <Badge variant="info">{s.site_type}</Badge> },
    { key: "address", header: "Address", render: (s) => s.address || "-" },
    { key: "contact_person", header: "Contact Person", render: (s) => s.contact_person || "-" },
    {
      key: "is_active",
      header: "Status",
      render: (s) => (
        <Badge variant={s.is_active ? "success" : "danger"}>
          {s.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-20",
      render: (s) => (
        <div className="flex items-center gap-1">
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(s);
              }}
              className="p-1.5 rounded hover:bg-danger/10 text-muted hover:text-danger"
              title="Delete site"
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
        <PageHeader title="Sites" description="Manage project sites and branch locations" />
        <div className="flex flex-col items-center justify-center py-24">
          <AlertTriangle size={40} className="text-warning mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Sites unavailable</h2>
          <p className="text-sm text-muted mt-1 mb-6 max-w-sm text-center">{loadError}</p>
          <Button variant="secondary" onClick={loadSites}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Sites"
        description="Manage project sites and branch locations"
        actions={
          canManage ? (
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Site
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          iconLeft={<Search size={16} />}
          wrapperClassName="max-w-sm"
        />
      </div>

      {sites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No sites yet"
          description="Create your first site to start dispatching goods."
          action={canManage ? { label: "Add Site", onClick: () => setShowAdd(true) } : undefined}
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={pageItems}
            onRowClick={(s) => router.push(`/sites/${s.id}`)}
            emptyMessage="No sites match your search"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Sites pagination"
          />
        </>
      )}

      {canManage && (
        <AddSiteModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={loadSites} />
      )}
    </div>
  );
}

function AddSiteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", address: "", site_type: "PROJECT", contact_person: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await addSite({
        name: form.name.trim(),
        address: form.address || null,
        site_type: form.site_type as Site["site_type"],
        contact_person: form.contact_person || null,
        is_active: true,
      });
      toast.success("Site created");
      onCreated();
      onClose();
      setForm({ name: "", address: "", site_type: "PROJECT", contact_person: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create site.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Site">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="e.g. Downtown Project Site"
        />
        <Select
          label="Type"
          value={form.site_type}
          onChange={(e) => setForm({ ...form, site_type: e.target.value })}
          options={SITE_TYPES.map((t) => ({ value: t, label: t }))}
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
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!form.name.trim()}>
            Create Site
          </Button>
        </div>
      </form>
    </Modal>
  );
}