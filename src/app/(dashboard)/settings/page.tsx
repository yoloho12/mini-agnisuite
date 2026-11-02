"use client";

import { useEffect, useState } from "react";
import { User, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import SignaturePad from "@/components/ui/SignaturePad";
import BackupCard from "@/components/settings/BackupCard";
import {
  fetchOrganization,
  updateOrganization,
  fetchAccount,
  updateAccount,
} from "@/app/actions/settingsActions";
import { fetchSites } from "@/app/actions/siteActions";
import { friendlyErrorMessage } from "@/lib/errors";
import type { Currency, Site } from "@/types";
import { ROLES } from "@/constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canManageBackups, canManageOrganization } from "@/lib/permissions";

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const canEditOrganization = canManageOrganization(user?.role);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your organization and preferences"
      />

      <div className="space-y-6 max-w-2xl">
        {canManageBackups(user?.role) && <BackupCard />}
        <OrganizationCard readOnly={!canEditOrganization} />
        <AccountCard />
      </div>
    </div>
  );
}

function OrganizationCard({ readOnly = false }: { readOnly?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("MMK");
  const [usdRate, setUsdRate] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchOrganization();
      if (cancelled) return;
      if (res.ok && res.data) {
        setName(res.data.name);
        setCurrency(res.data.base_currency);
        setUsdRate(res.data.usd_rate);
      } else if (!res.ok) {
        toast.error(res.error);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateOrganization({
        name,
        base_currency: currency,
        usd_rate: usdRate,
      });
      if (res.ok) {
        toast.success("Organization settings saved");
        setName(res.data.name);
        setCurrency(res.data.base_currency);
        setUsdRate(res.data.usd_rate);
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Could not save organization settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={18} className="text-primary" />
        <CardTitle>Organization</CardTitle>
      </div>
      <CardContent className="space-y-4">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <Input
              label="Organization Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your company name"
              disabled={readOnly}
            />
            <Select
              label="Base Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              disabled={readOnly}
              options={[
                { value: "MMK", label: "MMK (Myanmar Kyat)" },
                { value: "USD", label: "USD (US Dollar)" },
              ]}
            />
            <NumericInput
              label="USD Exchange Rate"
              value={usdRate}
              onChange={setUsdRate}
              allowDecimal
              disabled={readOnly}
            />
            {readOnly ? (
              <p className="text-xs text-muted">
                Only the organization owner can change these settings.
              </p>
            ) : (
              <Button onClick={handleSave} loading={saving}>
                <Save size={14} /> Save Changes
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AccountCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string>("");
  const [signature, setSignature] = useState<string | null>(null);
  const [editingSignature, setEditingSignature] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [res, siteList] = await Promise.all([fetchAccount(), fetchSites().catch(() => [] as Site[])]);
      if (cancelled) return;
      if (res.ok) {
        setFullName(res.data.fullName);
        setEmail(res.data.email);
        setRole(res.data.role);
        setSiteId(res.data.siteId ?? "");
        setSignature(res.data.signature ?? null);
        setEditingSignature(!res.data.signature);
      } else {
        toast.error(res.error);
      }
      setSites(siteList);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateAccount({
        fullName,
        signature,
      });
      if (res.ok) {
        toast.success("Profile updated");
        setFullName(res.data.fullName);
        setSiteId(res.data.siteId ?? "");
        setSignature(res.data.signature ?? null);
        if (res.data.signature) setEditingSignature(false);
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  };

  const assignedSite = sites.find((site) => site.id === siteId);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <User size={18} className="text-primary" />
        <CardTitle>Account</CardTitle>
      </div>
      <CardContent className="space-y-4">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Access role</span>
              <Badge variant="info">{ROLES[role as keyof typeof ROLES] ?? role}</Badge>
            </div>
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
            <Input label="Email" type="email" disabled value={email} />
            <div>
              <p className="mb-1 text-sm font-medium text-foreground-dim">Assigned site</p>
              <p className="text-sm text-foreground">
                {assignedSite?.name ?? (siteId ? "Assigned site" : "No site assigned")}
              </p>
            </div>
            <p className="-mt-2 text-xs text-muted">
              Site and location access are managed by your organization owner.
            </p>

            <div className="pt-1 border-t border-border">
              <div className="flex items-center justify-between mt-3 mb-2">
                <span className="text-sm font-medium text-foreground-dim">Digital Signature</span>
                {signature && !editingSignature && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditingSignature(true)}>
                    Redraw
                  </Button>
                )}
              </div>

              {signature && !editingSignature && (
                <div className="mb-3 rounded-lg border border-border bg-background p-3">
                  <img src={signature} alt="Your signature" className="h-16 object-contain" />
                </div>
              )}

              {(editingSignature || !signature) && (
                <SignaturePad label="" onChange={(d) => setSignature(d)} />
              )}
            </div>

            <Button onClick={handleSave} loading={saving}>
              <Save size={14} /> Update Profile
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
