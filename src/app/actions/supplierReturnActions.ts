"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireLocationAccess, requireRole } from "@/lib/auth";
import * as supplierReturnRepo from "@/repositories/supplierReturnRepo";
import { getSupplierPurchasedProducts } from "@/repositories/poRepo";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import * as contactRepo from "@/repositories/contactRepo";
import { canAccessLocation } from "@/lib/locationAccess";

export async function fetchSupplierReturns() {
  const [orgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const records = await supplierReturnRepo.getSupplierReturns(orgId);
  return records.filter((record) =>
    canAccessLocation(user, "WAREHOUSE", record.warehouse_id)
  );
}

export async function fetchSupplierReturn(id: string) {
  const record = await supplierReturnRepo.getSupplierReturn(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Supplier return");
  if (!canAccessLocation(await getCurrentUser(), "WAREHOUSE", record.warehouse_id)) {
    throw new Error("Supplier return not found.");
  }
  return record;
}

export async function addSupplierReturn(
  supplierId: string,
  warehouseId: string,
  reason: string,
  items: { product_id: string; quantity: number; unit_cost_mmk: number }[]
) {
  await requireRole(["owner", "manager", "staff_warehouse"]);
  await requireLocationAccess("WAREHOUSE", warehouseId);
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await warehouseRepo.getWarehouse(warehouseId), orgId, "Warehouse");
  assertOrganizationRecord(await contactRepo.getContact(supplierId), orgId, "Supplier");
  const result = await supplierReturnRepo.createSupplierReturnWithStock(
    orgId,
    supplierId,
    warehouseId,
    reason,
    items
  );
  revalidatePath("/returns");
  return result;
}

export async function fetchSupplierPurchasedProducts(supplierId: string, warehouseId: string) {
  await requireRole(["owner", "manager", "staff_warehouse"]);
  await requireLocationAccess("WAREHOUSE", warehouseId);
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await contactRepo.getContact(supplierId), orgId, "Supplier");
  return getSupplierPurchasedProducts(orgId, supplierId, warehouseId);
}