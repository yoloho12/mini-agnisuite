"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  MapPin,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card, { CardTitle } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fetchAdminOverview, removeAdminUser } from "@/app/actions/adminActions";
import type { AdminOverview, AdminUser } from "@/types/admin";
import type { UserRole } from "@/types";
import { ROLES, ROLE_DESCRIPTIONS } from "@/constants";
import { formatDate } from "@/lib/utils";
import UserFormModal from "./UserFormModal";

const roleVariant: Record<UserRole, "default" | "success" | "warning" | "info"> = {
  owner: "info",
  manager: "success",
  staff_warehouse: "warning",
  staff_site: "default",
  viewer: "default",
};

function formatJoined(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : formatDate(date);
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </Card>
  );
}

function LocationBadges({
  user,
  locationNames,
}: {
  user: AdminUser;
  locationNames: Map<string, string>;
}) {
  if (user.role === "owner" || user.role === "manager") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted">
        <ShieldCheck size={13} />
        All locations
      </span>
    );
  }

  const names = user.assignedLocations.map((id) => locationNames.get(id) ?? id);
  if (user.siteId && !user.assignedLocations.includes(user.siteId)) {
    names.unshift(locationNames.get(user.siteId) ?? user.siteId);
  }
  if (names.length === 0) {
    return <span className="text-sm text-muted">No locations</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {names.slice(0, 2).map((name) => (
        <span
          key={name}
          className="inline-flex max-w-[130px] items-center gap-1 rounded-md bg-muted/15 px-2 py-0.5 text-xs text-foreground-dim"
        >
          {name}
        </span>
      ))}
      {names.length > 2 && (
        <span className="rounded-md bg-muted/15 px-2 py-0.5 text-xs text-muted">
          +{names.length - 2}
        </span>
      )}
    </div>
  );
}

export default function AdminPanel() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchAdminOverview();
    if (result.ok) {
      setOverview(result.data);
      setError("");
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const users = overview?.users ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        ROLES[user.role].toLowerCase().includes(query)
    );
  }, [users, search]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 10);

  const locationNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const warehouse of overview?.warehouses ?? []) map.set(warehouse.id, warehouse.name);
    for (const site of overview?.sites ?? []) map.set(site.id, site.name);
    return map;
  }, [overview]);

  const counts = useMemo(() => {
    const next = { owner: 0, manager: 0, staff: 0, viewer: 0 };
    for (const user of users) {
      if (user.role === "owner") next.owner += 1;
      else if (user.role === "manager") next.manager += 1;
      else if (user.role === "staff_warehouse" || user.role === "staff_site") next.staff += 1;
      else next.viewer += 1;
    }
    return next;
  }, [users]);

  function openCreate() {
    setEditingUser(null);
    setFormOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingUser(null);
  }

  async function handleSaved(message: string) {
    toast.success(message);
    closeForm();
    await load();
  }

  async function handleRemove(user: AdminUser) {
    const label = user.fullName || user.email || "this member";
    const confirmed = window.confirm(
      `Remove ${label} from the organization?\n\nThey will lose access, but their history stays intact.`
    );
    if (!confirmed) return;

    setRemovingId(user.id);
    const result = await removeAdminUser(user.id);
    setRemovingId(null);
    if (!result.ok) {
      toast.error("Could not remove member", { description: result.error });
      return;
    }
    toast.success("Member removed", {
      description: `${label} no longer has access to this organization.`,
    });
    await load();
  }

  const columns = [
    {
      key: "user",
      header: "User",
      render: (user: AdminUser) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {user.fullName || "Unnamed user"}
          </p>
          <p className="truncate text-xs text-muted">{user.email || "No email"}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user: AdminUser) => (
        <Badge variant={roleVariant[user.role]}>{ROLES[user.role]}</Badge>
      ),
    },
    {
      key: "locations",
      header: "Access",
      render: (user: AdminUser) => (
        <LocationBadges user={user} locationNames={locationNames} />
      ),
    },
    {
      key: "created",
      header: "Added",
      render: (user: AdminUser) => (
        <span className="text-sm text-muted">{formatJoined(user.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-px",
      render: (user: AdminUser) => {
        const isSelf = user.id === overview?.currentUserId;
        const isLastOwner = user.role === "owner" && counts.owner <= 1;
        const removeDisabled = isSelf || isLastOwner || removingId === user.id;
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => openEdit(user)}
              aria-label={`Edit ${user.fullName || user.email}`}
              title="Edit role and location access"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => void handleRemove(user)}
              disabled={removeDisabled}
              aria-label={`Remove ${user.fullName || user.email}`}
              title={
                isSelf
                  ? "You cannot remove your own account"
                  : isLastOwner
                    ? "The organization must keep at least one owner"
                    : "Remove from organization"
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Create accounts and control what each member can access."
        actions={
          <Button onClick={openCreate}>
            <UserPlus size={16} />
            New user
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : !overview ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users size={28} className="text-muted" />
            <p className="text-sm text-muted">The admin panel could not be loaded.</p>
            <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }}>
              Try again
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Members" value={users.length} hint="In this organization" />
            <SummaryCard label="Owners" value={counts.owner} hint="Full control" />
            <SummaryCard label="Managers" value={counts.manager} hint="Daily operations" />
            <SummaryCard label="Staff" value={counts.staff} hint="Warehouse or site" />
            <SummaryCard label="Viewers" value={counts.viewer} hint="Read-only" />
          </div>

          {overview.demoMode && (
            <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
              <KeyRound size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Demo mode</p>
                <p className="mt-0.5 text-foreground-dim">
                  Accounts are stored in the local demo database and passwords are not
                  required. After creating a user, switch to it from the account menu in
                  the top-right.
                </p>
              </div>
            </div>
          )}

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Members</h2>
                <p className="text-sm text-muted">
                  {users.length} account{users.length === 1 ? "" : "s"} in this organization
                </p>
              </div>
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, or role..."
                iconLeft={<Search size={16} />}
                wrapperClassName="sm:w-72"
                aria-label="Search members"
              />
            </div>

            <Table
              columns={columns}
              data={pageItems}
              emptyMessage={
                search ? "No members match your search" : "No members in this organization yet"
              }
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              ariaLabel="Admin members pagination"
            />
          </section>

          <Card>
            <CardTitle>Permission model</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Roles control write access. Location assignments narrow staff access to
              specific warehouses or sites.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {(Object.keys(ROLES) as UserRole[]).map((role) => (
                <div
                  key={role}
                  className="rounded-lg border border-border bg-background/50 p-3"
                >
                  <Badge variant={roleVariant[role]}>{ROLES[role]}</Badge>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <WarehouseIcon size={13} /> Warehouse location
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> Site location
              </span>
            </div>
          </Card>
        </div>
      )}

      {formOpen && overview && (
        <UserFormModal
          key={editingUser?.id ?? "new"}
          open={formOpen}
          user={editingUser}
          overview={overview}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
