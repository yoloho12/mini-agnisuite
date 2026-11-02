"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireLocationAccess, requireRole } from "@/lib/auth";
import * as siteReturnRepo from "@/repositories/siteReturnRepo";
import * as productRepo from "@/repositories/productRepo";
import * as siteRepo from "@/repositories/siteRepo";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import { applyStockMovementBatch } from "@/services/stockMovementService";
import { generateReturnNumber } from "@/lib/numberGen";
import { canAccessLocation } from "@/lib/locationAccess";
import type { SiteReturn, SiteReturnLineItem } from "@/types";

export async function fetchSiteReturns(orgId?: string) {
  void orgId;
  const [currentOrgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const records = await siteReturnRepo.getSiteReturns(currentOrgId);
  return records.filter((record) =>
    canAccessLocation(user, "SITE", record.from_site_id) &&
    canAccessLocation(user, "WAREHOUSE", record.to_warehouse_id)
  );
}

export async function fetchSiteReturn(id: string) {
  const record = await siteReturnRepo.getSiteReturn(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Site return");
  const user = await getCurrentUser();
  if (
    !canAccessLocation(user, "SITE", record.from_site_id) ||
    !canAccessLocation(user, "WAREHOUSE", record.to_warehouse_id)
  ) {
    throw new Error("Site return not found.");
  }
  return record;
}

export async function addSiteReturn(
  returnData: Omit<SiteReturn, "id" | "created_at" | "return_number">,
  lineItems: Omit<SiteReturnLineItem, "id">[]
) {
  await requireRole(["owner", "manager", "staff_site"]);
  await requireLocationAccess("SITE", returnData.from_site_id);
  await requireLocationAccess("WAREHOUSE", returnData.to_warehouse_id);
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await siteRepo.getSite(returnData.from_site_id), orgId, "Site");
  assertOrganizationRecord(await warehouseRepo.getWarehouse(returnData.to_warehouse_id), orgId, "Warehouse");

  if (!returnData.from_site_id) throw new Error("Source site is required");
  if (!returnData.to_warehouse_id) throw new Error("Destination warehouse is required");
  if (!lineItems.length) throw new Error("Add at least one product to return");

  // Aggregate duplicate product lines, then validate against current site stock
  const qtyByProduct = new Map<string, number>();
  for (const li of lineItems) {
    if (!li.product_id) throw new Error("Every return line needs a product");
    if (!Number.isInteger(li.quantity) || li.quantity <= 0) {
      const name = (await productRepo.getProduct(li.product_id))?.name || li.product_id;
      throw new Error(`Quantity for ${name} must be a whole number greater than zero`);
    }
    qtyByProduct.set(li.product_id, (qtyByProduct.get(li.product_id) || 0) + li.quantity);
  }

  const shortages: string[] = [];
  for (const [productId, needed] of qtyByProduct) {
    const levels = await productRepo.getStockLevels(orgId, productId);
    const siteLevel = levels.find(
      (l) => l.location_type === "SITE" && l.location_id === returnData.from_site_id
    );
    const available = siteLevel?.quantity ?? 0;
    if (available <= 0) {
      const name = (await productRepo.getProduct(productId))?.name || productId;
      shortages.push(`${name} has no stock at this site`);
    } else if (needed > available) {
      const name = (await productRepo.getProduct(productId))?.name || productId;
      shortages.push(`${name} needs ${needed}, only ${available} at this site`);
    }
  }
  if (shortages.length > 0) {
    throw new Error(shortages.join("; "));
  }

  const existing = await siteReturnRepo.getSiteReturns(orgId);

  const record: Omit<SiteReturn, "id" | "created_at"> = {
    ...returnData,
    org_id: orgId,
    return_number: generateReturnNumber(existing.length + 1),
    status: "RETURNED",
    created_by: "",
  };

  const result = await siteReturnRepo.createSiteReturn(record);
  if (lineItems.length > 0) {
    await siteReturnRepo.createSiteReturnLineItems(
      lineItems.map((li) => ({ ...li, return_id: result.id }))
    );

    await applyStockMovementBatch(
      orgId,
      lineItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        from_location_type: "SITE",
        from_location_id: returnData.from_site_id,
        to_location_type: "WAREHOUSE",
        to_location_id: returnData.to_warehouse_id,
        note: "site_return",
      }))
    );
  }
  revalidatePath("/site-returns");
  return result;
}

export async function confirmSiteReturn(
  returnId: string,
  orgId: string,
  fromSiteId: string,
  toWarehouseId: string
) {
  await requireRole(["owner", "manager", "staff_site"]);
  const currentOrgId = await getCurrentOrgId();
  if (orgId !== currentOrgId) throw new Error("Organization mismatch.");
  await requireLocationAccess("SITE", fromSiteId);
  await requireLocationAccess("WAREHOUSE", toWarehouseId);
  const record = await siteReturnRepo.getSiteReturn(returnId);
  if (!record || record.org_id !== currentOrgId) throw new Error("Site return not found.");
  if (record.from_site_id !== fromSiteId || record.to_warehouse_id !== toWarehouseId) {
    throw new Error("Site return location mismatch.");
  }
  const items = await siteReturnRepo.getSiteReturnLineItems(returnId);

  await applyStockMovementBatch(
    currentOrgId,
    items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      from_location_type: "SITE",
      from_location_id: fromSiteId,
      to_location_type: "WAREHOUSE",
      to_location_id: toWarehouseId,
      note: "site_return_confirm",
    }))
  );

  const result = await siteReturnRepo.updateSiteReturn(returnId, { status: "RETURNED" });
  revalidatePath("/site-returns");
  return result;
}

export async function fetchSiteReturnLineItems(returnId: string) {
  await fetchSiteReturn(returnId);
  return siteReturnRepo.getSiteReturnLineItems(returnId);
}
