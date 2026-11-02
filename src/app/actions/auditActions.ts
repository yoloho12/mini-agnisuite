"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireLocationAccess, requireRole } from "@/lib/auth";
import * as auditRepo from "@/repositories/auditRepo";
import * as siteRepo from "@/repositories/siteRepo";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import { canAccessLocation } from "@/lib/locationAccess";

export async function fetchAudits() {
  const [orgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const records = await auditRepo.getAudits(orgId);
  return records.filter((record) =>
    canAccessLocation(user, record.location_type, record.location_id)
  );
}

export async function fetchAudit(id: string) {
  const record = await auditRepo.getAudit(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Audit");
  if (!canAccessLocation(await getCurrentUser(), record.location_type, record.location_id)) {
    throw new Error("Audit not found.");
  }
  return record;
}

export async function startAudit(
  locationType: "WAREHOUSE" | "SITE",
  locationId: string,
  category?: string
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
  const sheet = await auditRepo.generateCountSheet(orgId, locationType, locationId, category);
  const result = await auditRepo.createAudit({
    org_id: orgId,
    location_type: locationType,
    location_id: locationId,
    status: "IN_PROGRESS",
    count_sheet: sheet,
    discrepancies: [],
    created_by: "",
    approved_by: null,
    completed_at: null,
  });
  revalidatePath("/audits");
  return result;
}

export async function completeAudit(
  auditId: string,
  counts: { product_id: string; actual: number }[],
  locationType: "WAREHOUSE" | "SITE",
  locationId: string
) {
  await requireRole([
    "owner",
    "manager",
    ...(locationType === "WAREHOUSE" ? ["staff_warehouse" as const] : ["staff_site" as const]),
  ]);
  await requireLocationAccess(locationType, locationId);
  const orgId = await getCurrentOrgId();
  const audit = await auditRepo.getAudit(auditId);
  assertOrganizationRecord(audit, orgId, "Audit");
  if (audit.location_type !== locationType || audit.location_id !== locationId) {
    throw new Error("Audit location mismatch.");
  }
  if (audit.status !== "IN_PROGRESS") throw new Error("This audit is already complete.");
  if (counts.length !== audit.count_sheet.length) {
    throw new Error("Submit a count for every product on the audit sheet.");
  }
  const expectedProductIds = new Set(audit.count_sheet.map((row) => row.product_id));
  for (const count of counts) {
    if (!expectedProductIds.has(count.product_id)) throw new Error("Count includes a product not on this audit.");
    if (!Number.isInteger(count.actual) || count.actual < 0) {
      throw new Error("Actual counts must be non-negative whole numbers.");
    }
  }
  const result = await auditRepo.completeAuditWithAdjustments(
    orgId,
    auditId,
    counts,
    locationType,
    locationId,
    ""
  );
  revalidatePath("/audits");
  return result;
}