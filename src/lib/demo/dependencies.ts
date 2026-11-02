import { getTable, type DemoRows } from "./data";
import { DependencyError } from "../errors";

/**
 * Delete dependency rules for the local demo store.
 *
 * Mirrors the real Supabase schema (supabase/migrations/*.sql):
 * - `cascade` children are deleted with the parent (SQL ON DELETE CASCADE,
 *   plus app-level cleanup for polymorphic location refs that have no FK).
 * - `block` children restrict the delete (SQL RESTRICT / NO ACTION) — the
 *   delete fails with a DependencyError listing what still references it.
 */

export interface DeleteDependency {
  table: string;
  /** Simple FK column on the child table matching the parent's `id`. */
  column?: string;
  /** Custom match for polymorphic refs (e.g. stock_levels.location_id + location_type). */
  where?: (child: Record<string, unknown>, parent: Record<string, unknown>) => boolean;
  /** Singular noun used in the error message; plural is noun + "s". */
  noun?: string;
}

export interface DeleteRule {
  /** Entity name used in the error message ("product", "warehouse", ...). */
  entity: string;
  cascade: DeleteDependency[];
  block: DeleteDependency[];
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a) === String(b);
}

function matchesDep(
  dep: DeleteDependency,
  child: Record<string, unknown>,
  parent: Record<string, unknown>
): boolean {
  if (dep.where) return dep.where(child, parent);
  if (dep.column) return looseEqual(child[dep.column], parent.id);
  return false;
}

export const DELETE_RULES: Record<string, DeleteRule> = {
  products: {
    entity: "product",
    cascade: [
      { table: "stock_levels", column: "product_id" },
      { table: "price_history", column: "product_id" },
    ],
    block: [
      { table: "po_line_items", column: "product_id", noun: "purchase order line item" },
      { table: "dispatch_line_items", column: "product_id", noun: "dispatch line item" },
      { table: "site_return_line_items", column: "product_id", noun: "site return line item" },
      { table: "transfer_line_items", column: "product_id", noun: "stock transfer line item" },
      { table: "write_offs", column: "product_id", noun: "write-off" },
    ],
  },
  warehouses: {
    entity: "warehouse",
    cascade: [
      // stock_levels has no FK on location_id (polymorphic) — clean up at app level.
      {
        table: "stock_levels",
        where: (c, p) => c.location_type === "WAREHOUSE" && looseEqual(c.location_id, p.id),
      },
      {
        table: "write_offs",
        where: (c, p) => c.location_type === "WAREHOUSE" && looseEqual(c.location_id, p.id),
      },
      {
        table: "audits",
        where: (c, p) => c.location_type === "WAREHOUSE" && looseEqual(c.location_id, p.id),
      },
    ],
    block: [
      { table: "purchase_orders", column: "warehouse_id", noun: "purchase order" },
      { table: "dispatches", column: "from_warehouse_id", noun: "dispatch" },
      { table: "site_returns", column: "to_warehouse_id", noun: "site return" },
      { table: "stock_transfers", column: "from_warehouse_id", noun: "stock transfer" },
      { table: "stock_transfers", column: "to_warehouse_id", noun: "stock transfer" },
      { table: "supplier_returns", column: "warehouse_id", noun: "supplier return" },
    ],
  },
  sites: {
    entity: "site",
    cascade: [
      { table: "site_receivers", column: "site_id" },
      {
        table: "stock_levels",
        where: (c, p) => c.location_type === "SITE" && looseEqual(c.location_id, p.id),
      },
      {
        table: "write_offs",
        where: (c, p) => c.location_type === "SITE" && looseEqual(c.location_id, p.id),
      },
      {
        table: "audits",
        where: (c, p) => c.location_type === "SITE" && looseEqual(c.location_id, p.id),
      },
    ],
    block: [
      { table: "dispatches", column: "to_site_id", noun: "dispatch" },
      { table: "site_returns", column: "from_site_id", noun: "site return" },
    ],
  },
  contacts: {
    entity: "contact",
    cascade: [],
    block: [
      { table: "purchase_orders", column: "supplier_id", noun: "purchase order" },
      { table: "supplier_returns", column: "supplier_id", noun: "supplier return" },
    ],
  },
};

export interface ResolvedDeletes {
  /** table name → child row ids to cascade-delete */
  cascade: Map<string, Set<string>>;
  error: DependencyError | null;
}

/**
 * Resolves what a delete of `parents` from `table` should cascade and whether
 * it is blocked by remaining references. Returns a DependencyError (instead of
 * throwing) so the demo client can surface it as a Supabase-style result error.
 */
export function resolveDeleteDependencies(
  table: string,
  parents: Record<string, unknown>[]
): ResolvedDeletes {
  const rule = DELETE_RULES[table];
  const cascade = new Map<string, Set<string>>();
  if (!rule || parents.length === 0) return { cascade, error: null };

  // --- Blocking references -------------------------------------------------
  const counts = new Map<string, number>(); // noun → referenced row count
  for (const dep of rule.block) {
    const children = getTable(dep.table);
    for (const parent of parents) {
      for (const child of children) {
        if (matchesDep(dep, child, parent)) {
          const noun = dep.noun ?? dep.table;
          counts.set(noun, (counts.get(noun) ?? 0) + 1);
        }
      }
    }
  }
  if (counts.size > 0) {
    const plural = (noun: string, n: number) =>
      n === 1 ? noun : /(s|x|z|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`;
    const parts = [...counts.entries()].map(([noun, n]) => `${n} ${plural(noun, n)}`);
    const list =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
    return {
      cascade,
      error: new DependencyError(
        `Cannot delete this ${rule.entity} — it is still referenced by ${list}.`
      ),
    };
  }

  // --- Cascading children --------------------------------------------------
  for (const dep of rule.cascade) {
    const children = getTable(dep.table);
    for (const parent of parents) {
      for (const child of children) {
        if (matchesDep(dep, child, parent)) {
          let ids = cascade.get(dep.table);
          if (!ids) {
            ids = new Set();
            cascade.set(dep.table, ids);
          }
          if (child.id != null) ids.add(String(child.id));
        }
      }
    }
  }

  return { cascade, error: null };
}

/** Removes the given row ids from a table (in-memory store). */
export function removeRowsByIds(table: string, ids: Set<string>): number {
  const rows: DemoRows = getTable(table);
  let removed = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const id = rows[i]?.id;
    if (id != null && ids.has(String(id))) {
      rows.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

/**
 * One-time cleanup of rows orphaned by deletes that happened before cascade
 * support existed (or by imported/restored snapshots). Returns the list of
 * tables that changed so the caller can persist only those.
 */
export function cleanupOrphanedRows(): string[] {
  const idsIn = (table: string) => new Set(getTable(table).map((r) => String(r.id)));
  const products = idsIn("products");
  const warehouses = idsIn("warehouses");
  const sites = idsIn("sites");
  const pos = idsIn("purchase_orders");
  const dispatches = idsIn("dispatches");
  const returns = idsIn("site_returns");
  const transfers = idsIn("stock_transfers");

  const locationExists = (row: Record<string, unknown>) => {
    const type = row.location_type;
    const id = row.location_id != null ? String(row.location_id) : "";
    if (type === "WAREHOUSE") return warehouses.has(id);
    if (type === "SITE") return sites.has(id);
    return true;
  };

  const changed: string[] = [];
  const prune = (
    table: string,
    orphan: (row: Record<string, unknown>) => boolean
  ) => {
    const rows = getTable(table);
    const before = rows.length;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (orphan(rows[i])) rows.splice(i, 1);
    }
    if (rows.length !== before) changed.push(table);
  };
  const idOf = (v: unknown) => (v != null ? String(v) : "");

  prune("stock_levels", (r) => !products.has(idOf(r.product_id)) || !locationExists(r));
  prune("price_history", (r) => !products.has(idOf(r.product_id)));
  prune("write_offs", (r) => !products.has(idOf(r.product_id)) || !locationExists(r));
  prune("site_receivers", (r) => !sites.has(idOf(r.site_id)));
  prune("po_line_items", (r) => !pos.has(idOf(r.po_id)) || !products.has(idOf(r.product_id)));
  prune("po_receipts", (r) => !pos.has(idOf(r.po_id)));
  prune("po_attachments", (r) => !pos.has(idOf(r.po_id)));
  prune(
    "dispatch_line_items",
    (r) => !dispatches.has(idOf(r.dispatch_id)) || !products.has(idOf(r.product_id))
  );
  prune(
    "site_return_line_items",
    (r) => !returns.has(idOf(r.return_id)) || !products.has(idOf(r.product_id))
  );
  prune(
    "transfer_line_items",
    (r) => !transfers.has(idOf(r.transfer_id)) || !products.has(idOf(r.product_id))
  );
  prune("audits", (r) => !locationExists(r));

  return changed;
}
