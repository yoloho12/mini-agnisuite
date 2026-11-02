"use client";

import { useMemo, useState } from "react";
import { MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { createAdminUser, updateAdminUser } from "@/app/actions/adminActions";
import type { AdminLocationOption, AdminOverview, AdminUser } from "@/types/admin";
import type { UserRole } from "@/types";
import { ROLES, ROLE_DESCRIPTIONS } from "@/constants";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserFormModalProps {
  open: boolean;
  user: AdminUser | null;
  overview: AdminOverview;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}

function LocationChecklist({
  title,
  icon,
  items,
  selected,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  items: AdminLocationOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </div>
      <div className="max-h-44 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted">No {title.toLowerCase()} yet.</p>
        ) : (
          items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-card-hover"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="truncate text-foreground-dim">{item.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export default function UserFormModal({
  open,
  user,
  overview,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const isEdit = Boolean(user);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "viewer");
  const [siteId, setSiteId] = useState(user?.siteId ?? "");
  const [warehouseIds, setWarehouseIds] = useState<string[]>(() =>
    user
      ? user.assignedLocations.filter((id) =>
          overview.warehouses.some((warehouse) => warehouse.id === id)
        )
      : []
  );
  const [siteIds, setSiteIds] = useState<string[]>(() =>
    user
      ? user.assignedLocations.filter((id) =>
          overview.sites.some((site) => site.id === id)
        )
      : []
  );
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const isSelf = isEdit && user?.id === overview.currentUserId;

  const roleOptions = useMemo(
    () =>
      (Object.keys(ROLES) as UserRole[]).map((value) => ({
        value,
        label: ROLES[value],
      })),
    []
  );

  const siteOptions = useMemo(
    () => overview.sites.map((site) => ({ value: site.id, label: site.name })),
    [overview.sites]
  );

  const assignedLocations = useMemo(() => {
    const ids = [...warehouseIds, ...siteIds];
    if (siteId && !ids.includes(siteId)) ids.push(siteId);
    return ids;
  }, [warehouseIds, siteIds, siteId]);

  function toggle(list: string[], id: string, setList: (next: string[]) => void) {
    setList(list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const name = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!name) {
      setFormError("Full name is required.");
      return;
    }
    if (!isEdit && !EMAIL_PATTERN.test(normalizedEmail)) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (!isEdit && !overview.demoMode && password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (role === "staff_warehouse" && warehouseIds.length === 0) {
      setFormError("Assign at least one warehouse to warehouse staff.");
      return;
    }
    if (role === "staff_site" && !siteId && siteIds.length === 0) {
      setFormError("Choose a primary site or assign at least one site to site staff.");
      return;
    }

    setSaving(true);
    const payload = {
      fullName: name,
      role,
      siteId: siteId || null,
      assignedLocations,
    };

    const result =
      isEdit && user
        ? await updateAdminUser(user.id, payload)
        : await createAdminUser({
            ...payload,
            email: normalizedEmail,
            password: password || undefined,
          });

    if (!result.ok) {
      setFormError(result.error);
      setSaving(false);
      return;
    }

    setSaving(false);
    await onSaved(
      isEdit
        ? "Member permissions updated."
        : overview.demoMode
          ? "Demo account created. Switch to it from the account menu."
          : "Account created. Share the temporary password with the new member."
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit member" : "New user"}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="e.g. Aung Ko"
            required
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            disabled={isEdit}
            required={!isEdit}
            autoComplete="off"
          />
        </div>

        {!isEdit && !overview.demoMode && (
          <Input
            label="Temporary password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
            autoComplete="new-password"
          />
        )}

        {!isEdit && overview.demoMode && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground-dim">
            Demo mode: no password is needed. After creating the account, switch to it
            from the account menu in the top-right.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            options={roleOptions}
            disabled={isSelf}
          />
          <Select
            label="Primary site"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            options={siteOptions}
            placeholder="No primary site"
          />
        </div>

        {isSelf && (
          <p className="-mt-2 text-xs text-muted">
            You cannot change your own owner role. Another owner can update it.
          </p>
        )}

        <div>
          <p className="text-sm font-medium text-foreground-dim">Additional location access</p>
          <p className="mt-0.5 text-xs text-muted">
            Owners and managers can access every location. Staff only see the locations
            assigned here. Site staff need an assigned warehouse to send returns there.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <LocationChecklist
              title="Warehouses"
              icon={<WarehouseIcon size={14} />}
              items={overview.warehouses}
              selected={warehouseIds}
              onToggle={(id) => toggle(warehouseIds, id, setWarehouseIds)}
            />
            <LocationChecklist
              title="Sites"
              icon={<MapPin size={14} />}
              items={overview.sites}
              selected={siteIds}
              onToggle={(id) => toggle(siteIds, id, setSiteIds)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/50 px-4 py-3 text-xs text-muted">
          <span className="font-medium text-foreground-dim">{ROLES[role]}</span> —{" "}
          {ROLE_DESCRIPTIONS[role]}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
