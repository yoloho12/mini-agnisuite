import { createClient } from "@/lib/supabase/server";
import { generateTransferNumber } from "@/lib/numberGen";
import { DemoClient } from "@/lib/demo/demoClient";
import { getTable, nextId } from "@/lib/demo/data";
import { applyStockMovementBatch } from "@/services/stockMovementService";
import type { StockTransfer, TransferLineItem } from "@/types";

export async function getTransfers(orgId: string): Promise<StockTransfer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_transfers")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getTransfer(id: string): Promise<StockTransfer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_transfers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createTransfer(transfer: Omit<StockTransfer, "id" | "created_at">): Promise<StockTransfer> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_transfers")
    .insert(transfer)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransfer(id: string, updates: Partial<StockTransfer>): Promise<StockTransfer> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_transfers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTransferLineItems(transferId: string): Promise<TransferLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transfer_line_items")
    .select("*")
    .eq("transfer_id", transferId);
  if (error) throw error;
  return data || [];
}

export async function createTransferLineItems(items: Omit<TransferLineItem, "id">[]): Promise<TransferLineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transfer_line_items")
    .insert(items)
    .select();
  if (error) throw error;
  return data || [];
}

export async function getNextTransferSeq(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_transfers")
    .select("transfer_number")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (data?.length) {
    const match = data[0].transfer_number.match(/(\d+)$/);
    if (match) return Number(match[1]) + 1;
  }
  return 1;
}

export async function countTransfers(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("stock_transfers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) throw error;
  return count || 0;
}

export async function createTransferWithStock(
  orgId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  notes: string | null,
  lineItems: { product_id: string; quantity: number }[]
): Promise<StockTransfer> {
  if (!fromWarehouseId || !toWarehouseId) {
    throw new Error("Select both a source and a destination warehouse");
  }
  if (fromWarehouseId === toWarehouseId) {
    throw new Error("Source and destination must be different warehouses");
  }
  if (lineItems.length === 0) {
    throw new Error("Add at least one item to transfer");
  }

  // Validate lines and aggregate quantities (duplicate products combine).
  const qtyByProduct = new Map<string, number>();
  for (const li of lineItems) {
    if (!li.product_id) throw new Error("Each transfer line needs a product");
    if (!Number.isInteger(li.quantity) || li.quantity <= 0) {
      throw new Error("Transfer quantities must be whole numbers greater than zero");
    }
    qtyByProduct.set(li.product_id, (qtyByProduct.get(li.product_id) || 0) + li.quantity);
  }

  const supabase = await createClient();
  if (supabase instanceof DemoClient) {
    return supabase.atomic(
      ["stock_transfers", "transfer_line_items", "stock_levels"],
      () => {
        const products = getTable("products");
        const stockLevels = getTable("stock_levels");
        for (const [productId, quantity] of qtyByProduct) {
          const product = products.find((row) => row.id === productId && row.org_id === orgId);
          const source = stockLevels.find(
            (row) =>
              row.org_id === orgId &&
              row.product_id === productId &&
              row.location_type === "WAREHOUSE" &&
              row.location_id === fromWarehouseId
          );
          const available = Number(source?.quantity ?? 0);
          if (!product || quantity > available) {
            throw new Error(
              `Insufficient stock at source warehouse: ${product?.name || productId} (needs ${quantity}, has ${available})`
            );
          }
        }

        const transfers = getTable("stock_transfers");
        const latestSequence = transfers
          .filter((row) => row.org_id === orgId)
          .reduce((latest, row) => {
            const match = String(row.transfer_number ?? "").match(/(\d+)$/);
            return match ? Math.max(latest, Number(match[1])) : latest;
          }, 0);
        const transfer: StockTransfer = {
          id: nextId(),
          org_id: orgId,
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          transfer_number: generateTransferNumber(latestSequence + 1),
          status: "COMPLETED",
          notes,
          created_by: "dev-user-000",
          created_at: new Date().toISOString(),
        };
        transfers.push(transfer as unknown as Record<string, unknown>);

        const transferLines = getTable("transfer_line_items");
        for (const line of lineItems) {
          transferLines.push({ id: nextId(), transfer_id: transfer.id, ...line });
        }

        for (const [productId, quantity] of qtyByProduct) {
          const source = stockLevels.find(
            (row) =>
              row.org_id === orgId &&
              row.product_id === productId &&
              row.location_type === "WAREHOUSE" &&
              row.location_id === fromWarehouseId
          )!;
          const sourceQuantity = Number(source.quantity) - quantity;
          source.quantity = sourceQuantity;
          source.status =
            sourceQuantity <= 0
              ? "OUT_OF_STOCK"
              : sourceQuantity <= Number(source.reserved_quantity || 0)
                ? "LOW_STOCK"
                : "IN_STOCK";

          const destination = stockLevels.find(
            (row) =>
              row.org_id === orgId &&
              row.product_id === productId &&
              row.location_type === "WAREHOUSE" &&
              row.location_id === toWarehouseId
          );
          if (destination) {
            const destinationQuantity = Number(destination.quantity) + quantity;
            destination.quantity = destinationQuantity;
            destination.status =
              destinationQuantity <= 0
                ? "OUT_OF_STOCK"
                : destinationQuantity <= Number(destination.reserved_quantity || 0)
                  ? "LOW_STOCK"
                  : "IN_STOCK";
          } else {
            stockLevels.push({
              id: nextId(),
              org_id: orgId,
              product_id: productId,
              location_type: "WAREHOUSE",
              location_id: toWarehouseId,
              quantity,
              reserved_quantity: 0,
              status: "IN_STOCK",
            });
          }
        }

        return transfer;
      }
    );
  }

  // Availability check at the source warehouse — never overdraw.
  const productRepo = await import("@/repositories/productRepo");
  const shortages: string[] = [];
  for (const [productId, qty] of qtyByProduct) {
    const levels = await productRepo.getStockLevels(orgId, productId);
    const atSource = levels.find(
      (s) => s.location_type === "WAREHOUSE" && s.location_id === fromWarehouseId
    );
    const available = atSource?.quantity ?? 0;
    if (qty > available) {
      const product = await productRepo.getProduct(productId);
      shortages.push(`${product?.name || productId} (needs ${qty}, has ${available})`);
    }
  }
  if (shortages.length > 0) {
    throw new Error(`Insufficient stock at source warehouse: ${shortages.join("; ")}`);
  }

  const seq = await getNextTransferSeq(orgId);
  const transfer = await createTransfer({
    org_id: orgId,
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
    transfer_number: generateTransferNumber(seq),
    status: "COMPLETED",
    notes,
    created_by: "",
  });

  await createTransferLineItems(
    lineItems.map((li) => ({ transfer_id: transfer.id, ...li }))
  );

  await applyStockMovementBatch(orgId, Array.from(qtyByProduct, ([productId, qty]) => ({
    product_id: productId,
    quantity: qty,
    from_location_type: "WAREHOUSE",
    from_location_id: fromWarehouseId,
    to_location_type: "WAREHOUSE",
    to_location_id: toWarehouseId,
    note: "transfer",
  })));

  return transfer;
}