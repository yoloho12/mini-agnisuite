"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import * as productRepo from "@/repositories/productRepo";
import { canAccessLocation } from "@/lib/locationAccess";
import {
  DEFAULT_BARCODE_FORMAT,
  detectBarcodeFormat,
  generateBarcodeValue,
} from "@/lib/barcode";
import type { Product } from "@/types";

type ProductInput = Omit<Product, "id" | "created_at" | "updated_at" | "org_id">;

/**
 * Fills in missing barcodes with unique internal-use EAN-13 values. A barcode
 * supplied by the user is preserved, but must not already belong to another
 * product in the organisation.
 */
async function withGeneratedBarcodes(
  products: ProductInput[],
  orgId: string
): Promise<ProductInput[]> {
  const used = new Set(await productRepo.getBarcodeValues(orgId));

  return products.map((product) => {
    const barcode = product.barcode_value?.trim() ?? "";
    if (barcode) {
      if (used.has(barcode)) {
        throw new Error(`Barcode "${barcode}" is already assigned to another product`);
      }
      used.add(barcode);
      return {
        ...product,
        barcode_value: barcode,
        barcode_format: product.barcode_format ?? detectBarcodeFormat(barcode),
      };
    }

    const generated = generateBarcodeValue(used);
    used.add(generated);
    return {
      ...product,
      barcode_value: generated,
      barcode_format: product.barcode_format ?? DEFAULT_BARCODE_FORMAT,
    };
  });
}

export async function fetchProducts(orgId?: string) {
  void orgId;
  return productRepo.getProducts(await getCurrentOrgId());
}

export async function fetchProduct(id: string) {
  const record = await productRepo.getProduct(id);
  assertOrganizationRecord(record, await getCurrentOrgId(), "Product");
  return record;
}

export async function addProduct(product: ProductInput) {
  await requireRole(["owner", "manager"]);
  const orgId = await getCurrentOrgId();
  const [prepared] = await withGeneratedBarcodes([product], orgId);
  const result = await productRepo.createProduct({ ...prepared, org_id: orgId });
  revalidatePath("/products");
  return result;
}

export async function addProductsBulk(products: ProductInput[]) {
  await requireRole(["owner", "manager"]);
  const orgId = await getCurrentOrgId();
  const prepared = await withGeneratedBarcodes(products, orgId);
  const result = await productRepo.createProducts(
    prepared.map((product) => ({ ...product, org_id: orgId }))
  );
  revalidatePath("/products");
  return result;
}

export async function editProduct(id: string, updates: Partial<Product>) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await productRepo.getProduct(id), await getCurrentOrgId(), "Product");
  const safeUpdates = { ...updates };
  delete safeUpdates.org_id;
  // Detect a manual last-cost change so cost history stays complete.
  if (safeUpdates.last_purchase_cost_mmk !== undefined) {
    const current = await productRepo.getProduct(id);
    const newCost = safeUpdates.last_purchase_cost_mmk;
    const result = await productRepo.updateProduct(id, safeUpdates);
    if (current && current.last_purchase_cost_mmk !== newCost) {
      const orgId = await getCurrentOrgId();
      await productRepo.recordPriceHistory(orgId, id, newCost, 0, "MANUAL");
    }
    revalidatePath("/products");
    return result;
  }
  const result = await productRepo.updateProduct(id, safeUpdates);
  revalidatePath("/products");
  return result;
}

export async function removeProduct(id: string) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await productRepo.getProduct(id), await getCurrentOrgId(), "Product");
  await productRepo.deleteProduct(id);
  revalidatePath("/products");
}

export async function lookupBarcode(barcode: string) {
  const orgId = await getCurrentOrgId();
  return productRepo.getProductByBarcode(orgId, barcode);
}

export async function fetchProductStock(productId: string) {
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await productRepo.getProduct(productId), orgId, "Product");
  const [user, levels] = await Promise.all([
    getCurrentUser(),
    productRepo.getStockLevels(orgId, productId),
  ]);
  return levels.filter((level) =>
    canAccessLocation(user, level.location_type, level.location_id)
  );
}

export async function fetchStockLevels(orgId?: string) {
  void orgId;
  const [currentOrgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const levels = await productRepo.getAllStockLevels(currentOrgId);
  return levels.filter((level) =>
    canAccessLocation(user, level.location_type, level.location_id)
  );
}

export async function fetchPriceHistory(productId: string) {
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await productRepo.getProduct(productId), orgId, "Product");
  return productRepo.getPriceHistory(orgId, productId);
}

// Dedicated "update valuation price" flow: bumps the product's current
// value price and always records a price-history entry so the dashboard
// growth trend and cost history stay complete.
export async function updateProductPrice(id: string, newPrice: number) {
  await requireRole(["owner", "manager"]);
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    throw new Error("Price must be greater than zero");
  }
  const price = Math.round(newPrice);
  const orgId = await getCurrentOrgId();
  const current = await productRepo.getProduct(id);
  assertOrganizationRecord(current, orgId, "Product");
  if (price === current.last_purchase_cost_mmk) {
    throw new Error("Price is unchanged");
  }

  const supabase = await createClient();
  const orgRes = await supabase.from("organizations").select("usd_rate").eq("id", orgId).maybeSingle();
  const usdRate = Number(orgRes.data?.usd_rate || 0);

  const result = await productRepo.updateProduct(id, { last_purchase_cost_mmk: price });
  await productRepo.recordPriceHistory(orgId, id, price, usdRate, "MANUAL");
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return result;
}