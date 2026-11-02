import { getStoreSnapshot, getTable, nextId, replaceTable } from "./data";
import { resolveDeleteDependencies, removeRowsByIds } from "./dependencies";

type Mode = "select" | "insert" | "update" | "delete";

type MutateHook = (tables: string[]) => Promise<void> | void;

let mutationQueue: Promise<void> = Promise.resolve();

interface Filter {
  field: string;
  op: string;
  value: unknown;
}

interface OrCondition {
  field: string;
  op: string;
  value: string;
}

// Known foreign keys per related table (used for relation joins/filters).
const fkMap: Record<string, string> = {
  products: "product_id",
  warehouses: "warehouse_id",
  sites: "site_id",
  contacts: "contact_id",
  purchase_orders: "po_id",
  dispatches: "dispatch_id",
  site_returns: "return_id",
  stock_transfers: "transfer_id",
  supplier_returns: "supplier_return_id",
  organizations: "organization_id",
  suppliers: "supplier_id",
};

function singular(table: string): string {
  return table.endsWith("s") ? table.slice(0, -1) : table;
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") {
    return Number(a) === Number(b);
  }
  return String(a) === String(b);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DemoData = any[] & { [key: string]: any };

export type DemoResult = {
  data: DemoData | null;
  error: Error | null;
  count: number | null;
};

export class DemoBuilder {
  private table: string;
  private mode: Mode;
  private cols = "*";
  private countOption = false;
  private head = false;
  private filters: Filter[] = [];
  private orderField?: string;
  private orderAscending = true;
  private limitN?: number;
  private rangeFrom?: number;
  private rangeTo?: number;
  private payload?: unknown;
  private _post: "single" | "maybeSingle" | null = null;
  private hook?: MutateHook;

  constructor(table: string, mode: Mode = "select", payload?: unknown, hook?: MutateHook) {
    this.table = table;
    this.mode = mode;
    this.payload = payload;
    this.hook = hook;
  }

  select(cols: string = "*", opts?: { count?: "exact"; head?: boolean }): this {
    if (typeof cols === "string") this.cols = cols;
    if (opts?.count === "exact") this.countOption = true;
    if (opts?.head === true) this.head = true;
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, op: "eq", value });
    return this;
  }

  is(field: string, value: null | boolean): this {
    this.filters.push({ field, op: "is", value });
    return this;
  }

  in(field: string, values: unknown[]): this {
    this.filters.push({ field, op: "in", value: values });
    return this;
  }

  or(expr: string): this {
    this.filters.push({ field: expr, op: "or", value: null });
    return this;
  }

  gt(field: string, value: number): this {
    this.filters.push({ field, op: "gt", value });
    return this;
  }

  gte(field: string, value: number): this {
    this.filters.push({ field, op: "gte", value });
    return this;
  }

  lt(field: string, value: number): this {
    this.filters.push({ field, op: "lt", value });
    return this;
  }

  lte(field: string, value: number): this {
    this.filters.push({ field, op: "lte", value });
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }): this {
    this.orderField = field;
    this.orderAscending = opts?.ascending !== false;
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  /** Inclusive offset/limit window, mirroring Supabase/PostgREST `.range()`. */
  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single(): this {
    this.head = false;
    this.countOption = false;
    this._post = "single";
    return this;
  }

  maybeSingle(): this {
    this._post = "maybeSingle";
    return this;
  }

  insert(payload: unknown): DemoBuilder {
    return new DemoBuilder(this.table, "insert", payload, this.hook);
  }

  update(payload: unknown): DemoBuilder {
    return new DemoBuilder(this.table, "update", payload, this.hook);
  }

  delete(): DemoBuilder {
    return new DemoBuilder(this.table, "delete", undefined, this.hook);
  }

  then(
    onfulfilled?: (value: DemoResult) => DemoResult | PromiseLike<DemoResult>,
    onrejected?: (reason: unknown) => never
  ): Promise<DemoResult> {
    let result: Promise<DemoResult>;
    if (this.mode === "select") {
      result = this.execute();
    } else {
      result = mutationQueue.then(() => this.execute(), () => this.execute());
      mutationQueue = result.then(() => undefined, () => undefined);
    }
    return result.then(onfulfilled ?? this.resolve, (err) => {
      if (onrejected) return onrejected(err);
      throw err;
    });
  }

  private resolve(value: DemoResult): DemoResult {
    return value;
  }

  private resolveFilterValue(row: Record<string, unknown>, field: string): unknown {
    if (!field.includes(".")) return row[field];
    // relation filter: e.g. "purchase_orders.supplier_id"
    const [relTable, relCol] = field.split(".");
    const fk = fkMap[relTable] ?? `${singular(relTable)}_id`;
    const fkValue = row[fk];
    const relRow = getTable(relTable).find((r) => looseEqual(r.id, fkValue));
    return relRow ? relRow[relCol] : undefined;
  }

  private parseOrConditions(expr: string): OrCondition[] {
    return expr
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [field, op, ...rest] = part.split(".");
        return { field, op, value: rest.join(".") };
      });
  }

  private matches(row: Record<string, unknown>): boolean {
    for (const f of this.filters) {
      if (f.op === "or") {
        const conds = this.parseOrConditions(f.field as string);
        const any = conds.some((c) => {
          const actual = this.resolveFilterValue(row, c.field);
          if (c.op === "is") return c.value === "null" ? actual == null : actual === c.value;
          if (c.op === "eq") return looseEqual(actual, c.value);
          return false;
        });
        if (!any) return false;
        continue;
      }
      const actual = this.resolveFilterValue(row, f.field);
      if (f.op === "in") {
        const values = f.value as unknown[];
        if (!values.includes(actual) && !values.some((v) => looseEqual(v, actual))) {
          return false;
        }
        continue;
      }
      if (f.op === "is") {
        if (f.value === null ? actual != null : actual !== f.value) return false;
        continue;
      }
      if (f.op === "gt") {
        if (!(Number(actual) > Number(f.value))) return false;
        continue;
      }
      if (f.op === "gte") {
        if (!(Number(actual) >= Number(f.value))) return false;
        continue;
      }
      if (f.op === "lt") {
        if (!(Number(actual) < Number(f.value))) return false;
        continue;
      }
      if (f.op === "lte") {
        if (!(Number(actual) <= Number(f.value))) return false;
        continue;
      }
      if (f.op === "neq") {
        if (looseEqual(actual, f.value)) return false;
        continue;
      }
      // eq
      if (!looseEqual(actual, f.value)) return false;
    }
    return true;
  }

  private splitCols(): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of this.cols) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  private dedupeById(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const seen = new Set<unknown>();
    const out: Record<string, unknown>[] = [];
    for (const row of rows) {
      const id = row.id;
      if (id === undefined || id === null || !seen.has(id)) {
        if (id !== undefined && id !== null) seen.add(id);
        out.push(row);
      }
    }
    return out;
  }

  private sortRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!this.orderField) return rows;
    const field = this.orderField;
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        const sa = av == null ? "" : String(av);
        const sb = bv == null ? "" : String(bv);
        cmp = sa.localeCompare(sb);
      }
      return this.orderAscending ? cmp : -cmp;
    });
    return arr;
  }

  private fkFor(table: string): string {
    return fkMap[table] ?? `${singular(table)}_id`;
  }

  private project(row: Record<string, unknown>): Record<string, unknown> {
    if (this.cols === "*") return { ...row };
    const out: Record<string, unknown> = {};
    for (const col of this.splitCols()) {
      const relMatch = col.match(/^([A-Za-z_]+)(?:![^()]*)?\(([^)]+)\)$/);
      if (relMatch) {
        const relTable = relMatch[1];
        const relCols = relMatch[2].split(",").map((c) => c.trim());
        const fk = this.fkFor(relTable);
        const related = getTable(relTable)
          .filter((r) => looseEqual(r.id, row[fk]))
          .map((r) => {
            const obj: Record<string, unknown> = {};
            for (const rc of relCols) obj[rc] = r[rc];
            return obj;
          });
        out[relTable] = related;
      } else {
        out[col] = row[col];
      }
    }
    return out;
  }

  private applyPost(data: Record<string, unknown>[] | null): DemoResult {
    if (data === null) return { data: null, error: null, count: null };
    if (this._post === "single") {
      return { data: (data[0] ?? null) as unknown as DemoData, error: null, count: null };
    }
    if (this._post === "maybeSingle") {
      return { data: (data[0] ?? null) as unknown as DemoData, error: null, count: null };
    }
    return { data: this.dedupeById(data) as unknown as DemoData, error: null, count: data.length };
  }

  private async notifyMutated(tables: string[]): Promise<void> {
    await this.hook?.([...new Set(tables)]);
  }

  private async persistMutation<T>(tables: string[], mutate: () => T): Promise<T> {
    const snapshot = getStoreSnapshot();
    const result = mutate();
    try {
      await this.notifyMutated(tables);
      return result;
    } catch (err) {
      for (const [table, savedRows] of Object.entries(snapshot)) {
        replaceTable(table, savedRows);
      }
      throw err;
    }
  }

  private async execute(): Promise<DemoResult> {
    const rows = getTable(this.table);
    const matched = rows.filter((row) => this.matches(row));

    if (this.mode === "insert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = await this.persistMutation([this.table], () => {
        const insertedRows: Record<string, unknown>[] = [];
        for (const obj of incoming as Record<string, unknown>[]) {
          const row: Record<string, unknown> = { ...(obj ?? {}) };
          if (row.id === undefined || row.id === null) row.id = nextId();
          if (row.created_at === undefined) {
            row.created_at = new Date().toISOString();
          }
          if (row.updated_at === undefined) {
            row.updated_at = new Date().toISOString();
          }
          rows.push(row);
          insertedRows.push(row);
        }
        return insertedRows;
      });
      const projected = inserted.map((r) => this.project(r));
      return this.applyPost(projected);
    }

    if (this.mode === "update") {
      await this.persistMutation([this.table], () => {
        for (const row of matched) Object.assign(row, this.payload ?? {});
      });
      const projected = matched.map((r) => this.project(r));
      return this.applyPost(projected);
    }

    if (this.mode === "delete") {
      // Mirror real FK semantics: cascade children, block if still referenced.
      const { cascade, error: depError } = resolveDeleteDependencies(
        this.table,
        matched as Record<string, unknown>[]
      );
      if (depError) {
        return { data: null, error: depError, count: null };
      }
      const changedTables = [this.table, ...cascade.keys()];
      await this.persistMutation(changedTables, () => {
        for (const [childTable, ids] of cascade) removeRowsByIds(childTable, ids);
        for (const row of [...matched]) {
          const i = rows.indexOf(row);
          if (i >= 0) rows.splice(i, 1);
        }
      });
      return { data: null, error: null, count: matched.length };
    }

    // select
    if (this.head) {
      return { data: null, error: null, count: matched.length };
    }
    const ordered = this.sortRows(matched);
    let sliced = ordered;
    if (this.rangeFrom != null || this.rangeTo != null) {
      const from = Math.max(0, this.rangeFrom ?? 0);
      const to = this.rangeTo ?? ordered.length - 1;
      sliced = sliced.slice(from, to + 1);
    }
    if (this.limitN != null) sliced = sliced.slice(0, this.limitN);
    const projected = sliced.map((r) => this.project(r));
    const count = this.countOption ? matched.length : null;
    return { ...this.applyPost(projected), count };
  }
}

export class DemoClient {
  private hook?: MutateHook;

  constructor(hook?: MutateHook) {
    this.hook = hook;
  }

  from(table: string): DemoBuilder {
    return new DemoBuilder(table, "select", undefined, this.hook);
  }

  atomic<T>(tables: string[], mutate: () => T): Promise<T> {
    const execute = async () => {
      const snapshot = getStoreSnapshot();
      try {
        const result = mutate();
        await this.hook?.([...new Set(tables)]);
        return result;
      } catch (err) {
        for (const [table, savedRows] of Object.entries(snapshot)) {
          replaceTable(table, savedRows);
        }
        throw err;
      }
    };
    const result = mutationQueue.then(execute, execute);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async rpc(functionName: string, params: Record<string, unknown> = {}): Promise<{ data: unknown; error: Error | null }> {
    if (functionName === "create_dispatch_with_stock_batch") {
      const dispatch = (params.p_dispatch ?? {}) as Record<string, unknown>;
      const entries = Array.isArray(params.p_line_items)
        ? (params.p_line_items as Array<Record<string, unknown>>)
        : [];
      const orgId = String(dispatch.org_id ?? "");

      try {
        const result = await this.atomic(
          ["dispatches", "dispatch_line_items", "stock_levels"],
          () => {
            if (entries.length === 0) throw new Error("Add at least one product to dispatch");
            const dispatches = getTable("dispatches");
            const lineItems = getTable("dispatch_line_items");
            const stockLevels = getTable("stock_levels") as Array<Record<string, unknown>>;
            const dispatchId = nextId();
            const dispatchRow = {
              ...dispatch,
              id: dispatchId,
              org_id: orgId,
              status: "DISPATCHED",
              created_at: new Date().toISOString(),
            };

            for (const entry of entries) {
              const productId = String(entry.product_id ?? "");
              const quantity = Number(entry.quantity ?? 0);
              if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
                throw new Error("Dispatch quantities must be positive whole numbers");
              }
              const source = stockLevels.find((row) =>
                row.org_id === orgId &&
                row.product_id === productId &&
                row.location_type === "WAREHOUSE" &&
                row.location_id === dispatch.from_warehouse_id
              );
              if (!source || Number(source.quantity) < quantity) {
                throw new Error(`Insufficient stock for product ${productId} at source warehouse`);
              }
              const sourceQuantity = Number(source.quantity) - quantity;
              source.quantity = sourceQuantity;
              source.status = sourceQuantity <= 0
                ? "OUT_OF_STOCK"
                : sourceQuantity <= Number(source.reserved_quantity || 0)
                  ? "LOW_STOCK"
                  : "IN_STOCK";

              const destination = stockLevels.find((row) =>
                row.org_id === orgId &&
                row.product_id === productId &&
                row.location_type === "SITE" &&
                row.location_id === dispatch.to_site_id
              );
              if (destination) {
                const destinationQuantity = Number(destination.quantity) + quantity;
                destination.quantity = destinationQuantity;
                destination.status = destinationQuantity <= 0
                  ? "OUT_OF_STOCK"
                  : destinationQuantity <= Number(destination.reserved_quantity || 0)
                    ? "LOW_STOCK"
                    : "IN_STOCK";
              } else {
                stockLevels.push({
                  id: nextId(),
                  org_id: orgId,
                  product_id: productId,
                  location_type: "SITE",
                  location_id: dispatch.to_site_id,
                  quantity,
                  reserved_quantity: 0,
                  status: "IN_STOCK",
                });
              }

              lineItems.push({
                id: nextId(),
                dispatch_id: dispatchId,
                product_id: productId,
                quantity,
              });
            }

            dispatches.push(dispatchRow);
            return dispatchRow;
          }
        );
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }
    }

    if (functionName === "apply_stock_movement_batch") {
      const entries = Array.isArray(params.p_entries) ? (params.p_entries as Array<Record<string, unknown>>) : [];
      const orgId = String(params.p_org_id ?? "");

      try {
        const result = await this.atomic(["stock_levels"], () => {
          const stockLevels = getTable("stock_levels") as Array<Record<string, unknown>>;

          for (const entry of entries) {
            const productId = String(entry.product_id ?? "");
            const quantity = Number(entry.quantity ?? 0);
            const sourceType = entry.from_location_type as string | undefined;
            const sourceId = entry.from_location_id as string | undefined;
            const destinationType = entry.to_location_type as string | undefined;
            const destinationId = entry.to_location_id as string | undefined;

            if (sourceType && sourceId) {
              const source = stockLevels.find(
                (row) =>
                  row.org_id === orgId &&
                  row.product_id === productId &&
                  row.location_type === sourceType &&
                  row.location_id === sourceId
              );
              if (!source) {
                throw new Error(`No stock found for product ${productId} at ${sourceType} ${sourceId}`);
              }
              const available = Number(source.quantity ?? 0);
              if (available < quantity) {
                throw new Error(`Insufficient stock for product ${productId}. Needed ${quantity}, available ${available}.`);
              }
              const sourceQuantity = available - quantity;
              source.quantity = sourceQuantity;
              source.status =
                sourceQuantity <= 0
                  ? "OUT_OF_STOCK"
                  : sourceQuantity <= Number(source.reserved_quantity || 0)
                    ? "LOW_STOCK"
                    : "IN_STOCK";
            }

            if (destinationType && destinationId) {
              const destination = stockLevels.find(
                (row) =>
                  row.org_id === orgId &&
                  row.product_id === productId &&
                  row.location_type === destinationType &&
                  row.location_id === destinationId
              );
              if (destination) {
                const destinationQuantity = Number(destination.quantity ?? 0) + quantity;
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
                  location_type: destinationType,
                  location_id: destinationId,
                  quantity,
                  reserved_quantity: 0,
                  status: "IN_STOCK",
                });
              }
            }
          }

          return { ok: true, count: entries.length };
        });

        return { data: result, error: null };
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    }

    return { data: null, error: new Error(`RPC ${functionName} is not implemented`) };
  }

  auth = {
    getUser: async () => ({ data: { user: null }, error: null }),
  };
}

export function createDemoClient(hook?: MutateHook): DemoClient {
  return new DemoClient(hook);
}