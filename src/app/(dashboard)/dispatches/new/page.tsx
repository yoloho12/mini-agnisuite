"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import {
  addDispatch,
  fetchPermittedDispatchSenders,
  fetchPermittedReceivers,
} from "@/app/actions/dispatchActions";
import { fetchWarehouses } from "@/app/actions/warehouseActions";
import { fetchSiteReceivers, fetchSites } from "@/app/actions/siteActions";
import { fetchProducts, fetchProductStock } from "@/app/actions/productActions";
import { fetchCurrentUser } from "@/app/actions/settingsActions";
import { getProductIdParam, bestLocation, qtyAt } from "@/lib/quick-prefill";
import type { Warehouse, Site, SiteReceiver, Product } from "@/types";

interface LineItem {
  product_id: string;
  quantity: number;
}

export default function NewDispatchPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteReceivers, setSiteReceivers] = useState<SiteReceiver[]>([]);
  const [receiversLoading, setReceiversLoading] = useState(false);
  const [permittedReceivers, setPermittedReceivers] = useState<{
    id: string;
    full_name: string;
    role: string;
    site_id: string | null;
  }[]>([]);
  const [permittedLoading, setPermittedLoading] = useState(false);
  const [permittedSenders, setPermittedSenders] = useState<{ id: string; full_name: string }[]>([]);
  const [sendersLoading, setSendersLoading] = useState(false);

  const siteName = (sId: string) => sites.find((s) => s.id === sId)?.name ?? sId;

  const [products, setProducts] = useState<Product[]>([]);
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toSite, setToSite] = useState("");
  const [senderName, setSenderName] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ product_id: "", quantity: 1 }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const [w, s, p] = await Promise.all([
        fetchWarehouses(),
        fetchSites(),
        fetchProducts(),
      ]);
      const currentUser = await fetchCurrentUser();
      setWarehouses(w);
      setSites(s);
      setProducts(p);
      setSenderName(currentUser?.full_name ?? "");
      await prefillFromProductParam(p, w, s);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  /** Quick Actions launch here with ?product=<id> — prefill source, line, and destination. */
  async function prefillFromProductParam(allProducts: Product[], allWarehouses: Warehouse[], allSites: Site[]) {
    const paramId = getProductIdParam();
    const product = paramId ? allProducts.find((x) => x.id === paramId) : undefined;
    if (!product) return;
    setLineItems([{ product_id: product.id, quantity: 1 }]);
    try {
      const stockRows = await fetchProductStock(product.id);
      const from = bestLocation(stockRows, "WAREHOUSE");
      const to = bestLocation(stockRows, "SITE");
      if (from && allWarehouses.some((wh) => wh.id === from.location_id)) {
        setFromWarehouse(from.location_id);
        const available = qtyAt(stockRows, "WAREHOUSE", from.location_id);
        setLineItems([{ product_id: product.id, quantity: available > 0 ? available : 1 }]);
      }
      // Restock inference: dispatch to the site that already holds this product.
      if (to && to.quantity > 0 && allSites.some((st) => st.id === to.location_id)) {
        setToSite(to.location_id);
      }
    } catch {
      // Stock lookup is best-effort — the product line is already prefilled.
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSiteReceivers([]);
    if (!toSite) {
      setReceiversLoading(false);
      return;
    }

    setReceiversLoading(true);
    setPermittedLoading(true);
    Promise.all([fetchSiteReceivers(toSite), fetchPermittedReceivers(toSite)])
      .then(([receivers, permitted]) => {
        if (cancelled) return;
        setSiteReceivers(receivers);
        setPermittedReceivers(permitted);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load receiver suggestions for this site");
      })
      .finally(() => {
        if (!cancelled) {
          setReceiversLoading(false);
          setPermittedLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [toSite]);

  useEffect(() => {
    let cancelled = false;
    setPermittedSenders([]);
    if (!fromWarehouse) {
      setSendersLoading(false);
      return;
    }

    setSendersLoading(true);
    fetchPermittedDispatchSenders(fromWarehouse)
      .then((senders) => {
        if (!cancelled) {
          setPermittedSenders(senders.map(({ id, full_name }) => ({ id, full_name })));
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load sender suggestions for this warehouse");
      })
      .finally(() => {
        if (!cancelled) setSendersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromWarehouse]);

  function addLine() {
    setLineItems([...lineItems, { product_id: "", quantity: 1 }]);
  }

  function removeLine(i: number) {
    setLineItems(lineItems.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], [field]: value };
    setLineItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromWarehouse || !toSite || !senderName.trim() || !receiverName.trim()) {
      toast.error("Choose a warehouse and site, and enter sender and receiver names.");
      return;
    }
    if (!confirmed) {
      toast.error("Please confirm the dispatch is accurate before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const items = lineItems.filter((li) => li.product_id && li.quantity > 0);
      await addDispatch(
        {
          org_id: "",
          from_warehouse_id: fromWarehouse,
          to_site_id: toSite,
          status: "DISPATCHED",
          sender_name: senderName.trim(),
          receiver_name: receiverName.trim(),
          receiver_signature: null,
          dispatch_note: note || null,
          dispatched_by: "",
          dispatched_at: new Date().toISOString(),
        },
        items.map((li) => ({ dispatch_id: "", product_id: li.product_id, quantity: li.quantity }))
      );
      toast.success("Dispatch created");
      router.push("/dispatches");
    } catch (err) {
      toast.error("Failed to create dispatch", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Dispatch"
        description="Check goods out from warehouse to a site"
        actions={
          <Button variant="secondary" onClick={() => router.push("/dispatches")}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted mb-4">Failed to load dispatch data.</p>
          <Button onClick={load}>Retry</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          <Card>
            <CardTitle>Dispatch Details</CardTitle>
            <CardContent className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Source Warehouse"
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  placeholder="Select warehouse"
                  required
                />
                <Select
                  label="Destination Site"
                  value={toSite}
                  onChange={(e) => {
                    setToSite(e.target.value);
                    setReceiverName("");
                  }}
                  options={sites.map((s) => ({ value: s.id, label: s.name }))}
                  placeholder="Select site"
                  required
                />
              </div>
              <Input
                label="Sender Name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder={
                  sendersLoading
                    ? "Loading sender suggestions..."
                    : "Type a name or choose a suggestion"
                }
                list="dispatch-sender-suggestions"
                required
              />
              <datalist id="dispatch-sender-suggestions">
                {permittedSenders.map((sender) => (
                  <option key={sender.id} value={sender.full_name} />
                ))}
              </datalist>
              <Input
                label="Receiver Name"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Type a name or choose a suggestion"
                list="dispatch-receiver-suggestions"
                required
              />
              <datalist id="dispatch-receiver-suggestions">
                {[
                  ...siteReceivers.map((receiver) => ({
                    key: `saved-${receiver.id}`,
                    name: receiver.name,
                    detail: receiver.phone ?? "",
                  })),
                  ...permittedReceivers.map((user) => ({
                    key: `user-${user.id}`,
                    name: user.full_name,
                    detail: user.role,
                  })),
                ]
                  .filter((suggestion, index, suggestions) =>
                    suggestions.findIndex((candidate) => candidate.name === suggestion.name) === index
                  )
                  .map((suggestion) => (
                    <option key={suggestion.key} value={suggestion.name} label={suggestion.detail} />
                  ))}
              </datalist>
              {toSite && (
                <div className="-mt-2 space-y-2">
                  <p className="text-xs text-muted">
                    {receiversLoading || permittedLoading
                      ? "Loading receiver suggestions..."
                      : "Pick a receiver name (type or choose below)"}
                  </p>
                  {!receiversLoading && !permittedLoading && (
                    <div className="flex flex-wrap gap-2">
                      {siteReceivers.length > 0 && (
                        <>
                          <span className="text-[10px] text-muted uppercase tracking-wider">
                            From {siteName(toSite)}
                          </span>
                          {siteReceivers.map((receiver) => (
                            <Button
                              key={receiver.id}
                              type="button"
                              size="sm"
                              variant={receiverName === receiver.name ? "primary" : "secondary"}
                              onClick={() => setReceiverName(receiver.name)}
                              aria-pressed={receiverName === receiver.name}
                            >
                              {receiver.name}{receiver.phone ? ` · ${receiver.phone}` : ""}
                            </Button>
                          ))}
                        </>
                      )}
                      {permittedReceivers.length > 0 && (
                        <>
                          <span className="text-[10px] text-muted uppercase tracking-wider">
                            Other permitted users
                          </span>
                          {permittedReceivers
                            .filter(
                              (u) =>
                                !siteReceivers.some((r) => r.name === u.full_name) &&
                                u.full_name.trim().length > 0
                            )
                            .map((user) => (
                              <Button
                                key={user.id}
                                type="button"
                                size="sm"
                                variant={receiverName === user.full_name ? "primary" : "secondary"}
                                onClick={() => setReceiverName(user.full_name)}
                                aria-pressed={receiverName === user.full_name}
                                title={user.role}
                              >
                                {user.full_name}
                              </Button>
                            ))}
                        </>
                      )}
                      {(siteReceivers.length === 0 && permittedReceivers.length === 0) && (
                        <p className="text-xs text-muted">
                          No suggestions for this site. Type a name above.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Textarea
                label="Dispatch Note"
                id="dispatch-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
              />
            </CardContent>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                <Plus size={14} /> Add Item
              </Button>
            </div>
            <CardContent className="mt-4 space-y-3">
              {lineItems.map((li, i) => (
                <div key={i} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Select
                      label={i === 0 ? "Product" : ""}
                      value={li.product_id}
                      onChange={(e) => updateLine(i, "product_id", e.target.value)}
                      options={products.map((p) => ({ value: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}${p.category ? ` — ${p.category}` : ""}` }))}
                      placeholder="Select product"
                    />
                  </div>
                  <div className="w-24">
                    <NumericInput
                      label={i === 0 ? "Qty" : ""}
                      value={li.quantity}
                      onChange={(v) => updateLine(i, "quantity", v)}
                      min={1}
                    />
                  </div>
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="p-2 text-muted hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border bg-card accent-primary"
                />
                <span className="text-sm text-foreground-dim">
                  I confirm this dispatch is accurate and has been reviewed.
                </span>
              </label>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push("/dispatches")}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Dispatch
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}