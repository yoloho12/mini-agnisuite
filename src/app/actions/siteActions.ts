"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireRole } from "@/lib/auth";
import * as siteRepo from "@/repositories/siteRepo";
import { canAccessLocation } from "@/lib/locationAccess";
import type { Site, StockStatus } from "@/types";

export async function fetchSites(orgId?: string) {
  void orgId;
  const [currentOrgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const sites = await siteRepo.getSites(currentOrgId);
  return sites.filter((site) => canAccessLocation(user, "SITE", site.id));
}

export async function fetchSite(id: string) {
  const record = await siteRepo.getSite(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Site");
  if (!canAccessLocation(await getCurrentUser(), "SITE", id)) {
    throw new Error("Site not found.");
  }
  return record;
}

export async function addSite(site: Omit<Site, "id" | "created_at" | "org_id">) {
  await requireRole(["owner", "manager"]);
  const orgId = await getCurrentOrgId();
  const result = await siteRepo.createSite({ ...site, org_id: orgId });
  revalidatePath("/sites");
  return result;
}

export async function editSite(id: string, updates: Partial<Site>) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await siteRepo.getSite(id), await getCurrentOrgId(), "Site");
  const safeUpdates = { ...updates };
  delete safeUpdates.org_id;
  const result = await siteRepo.updateSite(id, safeUpdates);
  revalidatePath("/sites");
  return result;
}

export async function removeSite(id: string) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await siteRepo.getSite(id), await getCurrentOrgId(), "Site");
  await siteRepo.deleteSite(id);
  revalidatePath("/sites");
}

export async function fetchSiteReceivers(siteId: string) {
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await siteRepo.getSite(siteId), orgId, "Site");
  if (!canAccessLocation(await getCurrentUser(), "SITE", siteId)) {
    throw new Error("Site not found.");
  }
  return siteRepo.getSiteReceivers(orgId, siteId);
}

export async function addSiteReceiver(receiver: { site_id: string; name: string; phone: string | null; is_active: boolean }) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await siteRepo.getSite(receiver.site_id), await getCurrentOrgId(), "Site");
  return siteRepo.createSiteReceiver(receiver);
}

export interface SiteStockLevel {
  product_id: string;
  quantity: number;
  status: StockStatus;
  product_name: string | null;
  product_category: string | null;
}

export async function fetchSiteStockLevels(siteId: string): Promise<SiteStockLevel[]> {
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await siteRepo.getSite(siteId), orgId, "Site");
  if (!canAccessLocation(await getCurrentUser(), "SITE", siteId)) {
    throw new Error("Site not found.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_levels")
    .select("product_id, quantity, status, products(name, category)")
    .eq("org_id", orgId)
    .eq("location_type", "SITE")
    .eq("location_id", siteId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    product_id: row.product_id,
    quantity: row.quantity,
    status: row.status as StockStatus,
    product_name: row.products?.[0]?.name ?? null,
    product_category: row.products?.[0]?.category ?? null,
  }));
}