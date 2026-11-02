import { getAllStockLevels, getStockLevels } from "@/repositories/productRepo";
import type { StockLevel } from "@/types";

export async function getStockSummary(orgId: string) {
  const levels = await getAllStockLevels(orgId);

  const totalQty = levels.reduce((sum, l) => sum + Number(l.quantity), 0);
  const warehouseQty = levels
    .filter((l) => l.location_type === "WAREHOUSE")
    .reduce((sum, l) => sum + Number(l.quantity), 0);
  const siteQty = levels
    .filter((l) => l.location_type === "SITE")
    .reduce((sum, l) => sum + Number(l.quantity), 0);
  const lowStockCount = levels.filter((l) => l.status === "LOW_STOCK").length;
  const outOfStockCount = levels.filter((l) => l.status === "OUT_OF_STOCK").length;

  return {
    totalQty,
    warehouseQty,
    siteQty,
    lowStockCount,
    outOfStockCount,
    locationCount: levels.length,
  };
}

export async function getProductStock(
  orgId: string,
  productId: string
): Promise<StockLevel[]> {
  return getStockLevels(orgId, productId);
}

export async function checkAvailability(
  orgId: string,
  productId: string,
  locationType: string,
  locationId: string,
  requestedQty: number
): Promise<{ available: boolean; currentQty: number }> {
  const levels = await getStockLevels(orgId, productId);
  const level = levels.find(
    (l) => l.location_type === locationType && l.location_id === locationId
  );
  const currentQty = level ? Number(level.quantity) : 0;
  return {
    available: currentQty >= requestedQty,
    currentQty,
  };
}
