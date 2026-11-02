"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Trash2, Search } from "lucide-react";
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
import { fetchContacts, addContact, removeContact } from "@/app/actions/contactActions";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canManageMasterData } from "@/lib/permissions";
import type { Contact } from "@/types";

type FilterTab = "ALL" | "SUPPLIER" | "OTHER";

const tabs: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SUPPLIER", label: "Suppliers" },
  { value: "OTHER", label: "Others" },
];

export default function ContactsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManage = canManageMasterData(user?.role);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("ALL");

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchContacts();
      setContacts(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(c: Contact) {
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await removeContact(c.id);
      setContacts((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Contact removed");
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Failed to remove contact"));
    }
  }

  const filtered = contacts.filter((c) => {
    if (filter !== "ALL" && c.type !== filter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  const { page, setPage, totalPages, pageItems } = usePagination(filtered);

  const columns = [
    { key: "name", header: "Name" },
    {
      key: "type",
      header: "Type",
      render: (c: Contact) => (
        <Badge variant={c.type === "SUPPLIER" ? "info" : "default"}>{c.type}</Badge>
      ),
    },
    { key: "phone", header: "Phone", render: (c: Contact) => c.phone || "-" },
    { key: "email", header: "Email", render: (c: Contact) => c.email || "-" },
    {
      key: "blacklist_status",
      header: "Blacklist",
      render: (c: Contact) => (
        <Badge variant={c.blacklist_status ? "danger" : "success"}>
          {c.blacklist_status ? "Blacklisted" : "Clean"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (c: Contact) => (
        <div className="flex items-center gap-1">
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(c);
              }}
              className="p-1.5 rounded hover:bg-danger/10 text-muted hover:text-danger"
              title="Delete contact"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Manage suppliers and other contacts"
        actions={
          canManage ? (
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Contact
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load contacts.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add suppliers and other contacts to track them in one place."
          action={canManage ? { label: "Add Contact", onClick: () => setShowAdd(true) } : undefined}
        />
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <Input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              iconLeft={<Search size={16} />}
              wrapperClassName="max-w-sm"
            />
          </div>
          <div className="flex gap-2 mb-4">
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                size="sm"
                variant={filter === tab.value ? "primary" : "secondary"}
                onClick={() => { setFilter(tab.value); setPage(1); }}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <Table
            columns={columns}
            data={pageItems}
            onRowClick={(c) => router.push(`/contacts/${(c as unknown as Contact).id}`)}
            emptyMessage="No contacts match your filters"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Contacts pagination"
          />
        </>
      )}

      {canManage && (
        <AddContactModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} />
      )}
    </div>
  );
}

function AddContactModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", type: "SUPPLIER", phone: "", email: "", blacklist: false });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await addContact({
        name: form.name,
        type: form.type as Contact["type"],
        phone: form.phone || null,
        email: form.email || null,
        blacklist_status: form.blacklist,
        notes: null,
      });
      toast.success("Contact added");
      onCreated();
      onClose();
      setForm({ name: "", type: "SUPPLIER", phone: "", email: "", blacklist: false });
    } catch {
      toast.error("Failed to add contact");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Select
          label="Type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          options={[
            { value: "SUPPLIER", label: "Supplier" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.blacklist}
            onChange={(e) => setForm({ ...form, blacklist: e.target.checked })}
            className="h-4 w-4 rounded border-border bg-card accent-primary"
          />
          Blacklisted
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Contact</Button>
        </div>
      </form>
    </Modal>
  );
}