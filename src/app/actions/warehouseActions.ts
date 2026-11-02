"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireRole } from "@/lib/auth";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import * as productRepo from "@/repositories/productRepo";
import { canAccessLocation } from "@/lib/locationAccess";
import type { StockStatus, Warehouse } from "@/types";

export async function fetchWarehouses(orgId?: string) {
  void orgId;
  const [currentOrgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const warehouses = await warehouseRepo.getWarehouses(currentOrgId);
  return warehouses.filter((warehouse) => canAccessLocation(user, "WAREHOUSE", warehouse.id));
}

export async function fetchWarehouse(id: string) {
  const record = await warehouseRepo.getWarehouse(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Warehouse");
  if (!canAccessLocation(await getCurrentUser(), "WAREHOUSE", id)) {
    throw new Error("Warehouse not found.");
  }
  return record;
}

export async function addWarehouse(warehouse: Omit<Warehouse, "id" | "created_at" | "org_id">) {
  await requireRole(["owner", "manager"]);
  const orgId = await getCurrentOrgId();
  const result = await warehouseRepo.createWarehouse({ ...warehouse, org_id: orgId });
  revalidatePath("/warehouses");
  return result;
}

export async function editWarehouse(id: string, updates: Partial<Warehouse>) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await warehouseRepo.getWarehouse(id), await getCurrentOrgId(), "Warehouse");
  const safeUpdates = { ...updates };
  delete safeUpdates.org_id;
  const result = await warehouseRepo.updateWarehouse(id, safeUpdates);
  revalidatePath("/warehouses");
  return result;
}

export async function removeWarehouse(id: string) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await warehouseRepo.getWarehouse(id), await getCurrentOrgId(), "Warehouse");
  await warehouseRepo.deleteWarehouse(id);
  revalidatePath("/warehouses");
}

export async function fetchWarehouseSummary() {
  const orgId = await getCurrentOrgId();
  const user = await getCurrentUser();
  const [allWarehouses, allLevels] = await Promise.all([
    warehouseRepo.getWarehouses(orgId),
    productRepo.getAllStockLevels(orgId),
  ]);
  const warehouses = allWarehouses.filter((warehouse) =>
    canAccessLocation(user, "WAREHOUSE", warehouse.id)
  );
  const scopedLevels = allLevels.filter((level) =>
    canAccessLocation(user, level.location_type, level.location_id)
  );
  const totalQty = scopedLevels.reduce((sum, level) => sum + Number(level.quantity), 0);
  const warehouseQty = scopedLevels
    .filter((level) => level.location_type === "WAREHOUSE")
    .reduce((sum, level) => sum + Number(level.quantity), 0);
  const siteQty = scopedLevels
    .filter((level) => level.location_type === "SITE")
    .reduce((sum, level) => sum + Number(level.quantity), 0);
  const summary = {
    totalQty,
    warehouseQty,
    siteQty,
    lowStockCount: scopedLevels.filter((level) => level.status === "LOW_STOCK").length,
    outOfStockCount: scopedLevels.filter((level) => level.status === "OUT_OF_STOCK").length,
    locationCount: scopedLevels.length,
  };
  return { warehouses, summary };
}

export interface WarehouseStockLevel {
  product_id: string;
  quantity: number;
  status: StockStatus;
  product_name: string | null;
  product_category: string | null;
}

export async function fetchWarehouseStockLevels(warehouseId: string): Promise<WarehouseStockLevel[]> {
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await warehouseRepo.getWarehouse(warehouseId), orgId, "Warehouse");
  if (!canAccessLocation(await getCurrentUser(), "WAREHOUSE", warehouseId)) {
    throw new Error("Warehouse not found.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_levels")
    .select("product_id, quantity, status, products(name, category)")
    .eq("org_id", orgId)
    .eq("location_type", "WAREHOUSE")
    .eq("location_id", warehouseId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    product_id: row.product_id,
    quantity: row.quantity,
    status: row.status as StockStatus,
    product_name: row.products?.[0]?.name ?? null,
    product_category: row.products?.[0]?.category ?? null,
  }));
}