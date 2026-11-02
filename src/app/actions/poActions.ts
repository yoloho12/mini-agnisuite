"use server";

import { revalidatePath } from "next/cache";
import { assertOrganizationRecord, getCurrentOrgId, getCurrentUser, requireLocationAccess, requireRole } from "@/lib/auth";
import * as poRepo from "@/repositories/poRepo";
import * as productRepo from "@/repositories/productRepo";
import * as warehouseRepo from "@/repositories/warehouseRepo";
import * as siteRepo from "@/repositories/siteRepo";
import * as contactRepo from "@/repositories/contactRepo";
import { canAccessLocation } from "@/lib/locationAccess";
import { applyStockMovementBatch } from "@/services/stockMovementService";
import { generatePoNumber, generateSlipNumber } from "@/lib/numberGen";
import type { PurchaseOrder, POLineItem } from "@/types";

async function filterAccessiblePurchaseOrders(
  orders: PurchaseOrder[],
  user: Awaited<ReturnType<typeof getCurrentUser>>
): Promise<PurchaseOrder[]> {
  if (!user) return [];
  if (user.role === "owner" || user.role === "manager") return orders;
  const warehouseAccessible = orders.filter((order) =>
    canAccessLocation(user, "WAREHOUSE", order.warehouse_id)
  );
  if (warehouseAccessible.length === 0) return [];
  const lines = await poRepo.getPOLineItemsForOrders(
    warehouseAccessible.map((order) => order.id)
  );
  const linesByOrder = new Map<string, POLineItem[]>();
  for (const line of lines) {
    const orderLines = linesByOrder.get(line.po_id) ?? [];
    orderLines.push(line);
    linesByOrder.set(line.po_id, orderLines);
  }
  return warehouseAccessible.filter((order) =>
    (linesByOrder.get(order.id) ?? []).every((line) => {
      const locationType = line.dest_type ?? "WAREHOUSE";
      const locationId =
        locationType === "SITE" ? line.dest_id ?? "" : order.warehouse_id;
      return canAccessLocation(user, locationType, locationId);
    })
  );
}

export async function fetchPurchaseOrders(orgId?: string) {
  void orgId;
  const [currentOrgId, user] = await Promise.all([getCurrentOrgId(), getCurrentUser()]);
  const records = await poRepo.getPurchaseOrders(currentOrgId);
  return filterAccessiblePurchaseOrders(records, user);
}

export async function fetchPurchaseOrder(id: string) {
  const record = await poRepo.getPurchaseOrder(id);
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(record, orgId, "Purchase order");
  if ((await filterAccessiblePurchaseOrders([record], await getCurrentUser())).length === 0) {
    throw new Error("Purchase order not found.");
  }
  return record;
}

export async function addPurchaseOrder(
  po: Omit<PurchaseOrder, "id" | "created_at" | "updated_at" | "po_number">,
  lineItems: Omit<POLineItem, "id" | "po_id" | "status" | "qty_received">[]
) {
  await requireRole(["owner", "manager"]);
  const orgId = await getCurrentOrgId();
  assertOrganizationRecord(await warehouseRepo.getWarehouse(po.warehouse_id), orgId, "Warehouse");
  assertOrganizationRecord(await contactRepo.getContact(po.supplier_id), orgId, "Supplier");
  for (const line of lineItems) {
    assertOrganizationRecord(await productRepo.getProduct(line.product_id), orgId, "Product");
    if (line.dest_type === "SITE" && line.dest_id) {
      assertOrganizationRecord(await siteRepo.getSite(line.dest_id), orgId, "Site");
    }
  }
  const existing = await poRepo.getPurchaseOrders(orgId);

  const record: Omit<PurchaseOrder, "id" | "created_at" | "updated_at"> = {
    ...po,
    org_id: orgId,
    po_number: generatePoNumber(existing.length + 1),
    status: "PENDING",
    created_by: "",
  };

  const result = await poRepo.createPurchaseOrder(record);
  if (lineItems.length > 0) {
    await poRepo.createPOLineItems(
      lineItems.map((li) => ({
        po_id: result.id,
        product_id: li.product_id,
        qty_ordered: li.qty_ordered,
        qty_received: 0,
        unit_cost_mmk: li.unit_cost_mmk,
        status: "PENDING" as const,
        dest_type: li.dest_type ?? ("WAREHOUSE" as const),
        dest_id: li.dest_id ?? null,
      }))
    );
  }
  revalidatePath("/purchase-orders");
  return result;
}

export async function updatePOStatus(id: string, status: PurchaseOrder["status"]) {
  await requireRole(["owner", "manager"]);
  assertOrganizationRecord(await poRepo.getPurchaseOrder(id), await getCurrentOrgId(), "Purchase order");
  const result = await poRepo.updatePurchaseOrder(id, { status });
  revalidatePath("/purchase-orders");
  return result;
}

export async function receivePOItems(
  poId: string,
  receivedItems: { line_item_id: string; product_id: string; qty: number; unit_cost_mmk: number }[],
  receivedBy: string,
  supplierName: string,
  signature?: string | null
) {
  const user = await requireRole(["owner", "manager", "staff_warehouse", "staff_site"]);
  const orgId = await getCurrentOrgId();
  const po = await poRepo.getPurchaseOrder(poId);
  if (!po || po.org_id !== orgId) throw new Error("PO not found");
  if ((await filterAccessiblePurchaseOrders([po], user)).length === 0) {
    throw new Error("Purchase order not found.");
  }
  if (user.role === "staff_site" && !user.signature) {
    throw new Error("Save your digital signature in Settings before receiving for a site.");
  }
  if (po.status === "CANCELLED" || po.status === "RECEIVED") {
    throw new Error("This purchase order cannot receive additional items.");
  }

  const lineItems = await poRepo.getPOLineItems(poId);
  if (receivedItems.length === 0) throw new Error("Add at least one item to receive.");

  const qtyByLine = new Map<string, number>();
  for (const item of receivedItems) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error("Received quantity must be a whole number greater than zero");
    }
    if (!Number.isFinite(item.unit_cost_mmk) || item.unit_cost_mmk < 0) {
      throw new Error("Unit cost must be zero or greater.");
    }
    const line = lineItems.find((candidate) => candidate.id === item.line_item_id);
    if (!line || line.product_id !== item.product_id) {
      throw new Error("A received item does not match a purchase order line.");
    }
    qtyByLine.set(line.id, (qtyByLine.get(line.id) ?? 0) + item.qty);
  }

  const planned = await Promise.all(receivedItems.map(async (item) => {
    const line = lineItems.find((candidate) => candidate.id === item.line_item_id)!;
    const destinationType = line.dest_type ?? "WAREHOUSE";
    const destinationId = (destinationType === "SITE" ? line.dest_id : null) ?? po.warehouse_id;
    if (user.role === "staff_site" && destinationType !== "SITE") {
      throw new Error("Site staff can only receive items allocated to a site.");
    }
    if (destinationType === "SITE") {
      assertOrganizationRecord(await siteRepo.getSite(destinationId), orgId, "Site");
    } else {
      assertOrganizationRecord(await warehouseRepo.getWarehouse(destinationId), orgId, "Warehouse");
    }
    return { item, line, destinationType, destinationId };
  }));

  for (const [lineId, quantity] of qtyByLine) {
    const line = lineItems.find((candidate) => candidate.id === lineId)!;
    if (line.qty_received + quantity > line.qty_ordered) {
      throw new Error(
        `Cannot receive ${quantity} more of ${line.product_id}; only ${line.qty_ordered - line.qty_received} remain on the order.`
      );
    }
  }

  for (const { line, destinationType, destinationId } of planned) {
    assertOrganizationRecord(await productRepo.getProduct(line.product_id), orgId, "Product");
    await requireLocationAccess(destinationType, destinationId);
  }

  // Slip sequencing per supplier
  const allReceipts = await poRepo.getPOReceipts(poId);
  const slipSeq = allReceipts.length + 1;
  const slipNumber = generateSlipNumber(supplierName || "Supplier", slipSeq);

  const receipt = await poRepo.createPOReceipt({
    po_id: poId,
    org_id: orgId,
    slip_number: slipNumber,
    supplier_slip_seq: slipSeq,
    received_by: user.role === "staff_site" ? user.full_name : receivedBy.trim(),
    received_items: receivedItems,
    received_at: new Date().toISOString(),
    receiver_signature: user.role === "staff_site" ? user.signature : signature ?? null,
  });

  // All lines and quantities are validated before the first write.
  for (const { item, line, destinationType, destinationId } of planned) {
    const receivedQty = line.qty_received + (qtyByLine.get(line.id) ?? 0);
    await poRepo.updatePOLineItem(line.id, {
      qty_received: receivedQty,
      status: receivedQty >= line.qty_ordered ? "RECEIVED" : "PARTIAL",
    });
    await applyStockMovementBatch(orgId, [
      {
        product_id: item.product_id,
        quantity: item.qty,
        to_location_type: destinationType,
        to_location_id: destinationId,
        note: "po_receipt",
      },
    ]);
    // Keep cost history + last-purchase suggestion up to date with the received price.
    await productRepo.updateProduct(item.product_id, {
      last_purchase_cost_mmk: item.unit_cost_mmk,
      updated_at: new Date().toISOString(),
    });
    await productRepo.recordPriceHistory(orgId, item.product_id, item.unit_cost_mmk, po.usd_rate || 0, "PO");
  }

  // Update PO status
  const allLines = await poRepo.getPOLineItems(poId);
  const fullyReceived = allLines.length > 0 && allLines.every((li) => li.status === "RECEIVED");
  const anyReceived = allLines.some((li) => li.qty_received > 0);
  const status = fullyReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : "PENDING";
  await poRepo.updatePurchaseOrder(poId, { status });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${poId}`);
  return receipt;
}

export async function fetchPOLineItems(poId: string) {
  await fetchPurchaseOrder(poId);
  return poRepo.getPOLineItems(poId);
}

export async function fetchPOReceipts(poId: string) {
  await fetchPurchaseOrder(poId);
  return poRepo.getPOReceipts(poId);
}

export async function fetchPOAttachments(poId: string) {
  await fetchPurchaseOrder(poId);
  return poRepo.getPOAttachments(poId);
}

export async function addPOAttachment(attachment: Omit<import("@/types").POAttachment, "id">) {
  await requireRole(["owner", "manager", "staff_warehouse"]);
  const orgId = await getCurrentOrgId();
  await fetchPurchaseOrder(attachment.po_id);
  return poRepo.createPOAttachment({ ...attachment, org_id: orgId });
}

export async function getNextSlipNumber(poId: string, supplierName: string): Promise<string> {
  await fetchPurchaseOrder(poId);
  const receipts = await poRepo.getPOReceipts(poId);
  return generateSlipNumber(supplierName || "Supplier", receipts.length + 1);
}