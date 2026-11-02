"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireLocationAccess, requireRole } from "@/lib/auth";
import * as transferRepo from "@/repositories/transferRepo";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import { canAccessLocation } from "@/lib/locationAccess";

export async function fetchTransfers() {
  const [orgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const records = await transferRepo.getTransfers(orgId);
  return records.filter((record) =>
    canAccessLocation(user, "WAREHOUSE", record.from_warehouse_id) &&
    canAccessLocation(user, "WAREHOUSE", record.to_warehouse_id)
  );
}

export async function fetchTransfer(id: string) {
  const record = await transferRepo.getTransfer(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Transfer");
  const user = await getCurrentUser();
  if (
    !canAccessLocation(user, "WAREHOUSE", record.from_warehouse_id) ||
    !canAccessLocation(user, "WAREHOUSE", record.to_warehouse_id)
  ) {
    throw new Error("Transfer not found.");
  }
  return record;
}

export async function fetchTransferLineItems(id: string) {
  await fetchTransfer(id);
  return transferRepo.getTransferLineItems(id);
}

export async function addTransfer(
  fromWarehouseId: string,
  toWarehouseId: string,
  notes: string | null,
  lineItems: { product_id: string; quantity: number }[]
) {
  await requireRole(["owner", "manager", "staff_warehouse"]);
  await requireLocationAccess("WAREHOUSE", fromWarehouseId);
  await requireLocationAccess("WAREHOUSE", toWarehouseId);
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await warehouseRepo.getWarehouse(fromWarehouseId), orgId, "Warehouse");
  assertOrganizationRecord(await warehouseRepo.getWarehouse(toWarehouseId), orgId, "Warehouse");
  const result = await transferRepo.createTransferWithStock(
    orgId,
    fromWarehouseId,
    toWarehouseId,
    notes,
    lineItems
  );
  revalidatePath("/transfers");
  return result;
}