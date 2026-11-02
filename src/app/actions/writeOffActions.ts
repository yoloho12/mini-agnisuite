"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireLocationAccess, requireRole } from "@/lib/auth";
import * as writeOffRepo from "@/repositories/writeOffRepo";
import * as productRepo from "@/repositories/productRepo";
import * as siteRepo from "@/repositories/siteRepo";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import { canAccessLocation } from "@/lib/locationAccess";

export async function fetchWriteOffs() {
  const [orgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const records = await writeOffRepo.getWriteOffs(orgId);
  return records.filter((record) =>
    canAccessLocation(user, record.location_type, record.location_id)
  );
}

export async function addWriteOff(
  locationType: "WAREHOUSE" | "SITE",
  locationId: string,
  productId: string,
  quantity: number,
  reason: string,
  notes: string | null
) {
  await requireRole([
    "owner",
    "manager",
    ...(locationType === "WAREHOUSE" ? ["staff_warehouse" as const] : ["staff_site" as const]),
  ]);
  await requireLocationAccess(locationType, locationId);
  const orgId = await getCurrentOrgId();
  if (locationType === "SITE") {
    assertOrganizationRecord(await siteRepo.getSite(locationId), orgId, "Site");
  } else {
    assertOrganizationRecord(await warehouseRepo.getWarehouse(locationId), orgId, "Warehouse");
  }
  assertOrganizationRecord(await productRepo.getProduct(productId), orgId, "Product");
  const result = await writeOffRepo.createWriteOffWithStock(orgId, {
    org_id: orgId,
    location_type: locationType,
    location_id: locationId,
    product_id: productId,
    quantity,
    reason: reason as "DAMAGED" | "EXPIRED" | "LOST" | "OTHER",
    notes,
    created_by: "",
  });
  revalidatePath("/write-offs");
  return result;
}