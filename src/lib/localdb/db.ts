import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import {
  getTable,
  replaceTable,
  listTables,
  getStoreSnapshot,
  type DemoRows,
} from "@/lib/demo/data";
import { cleanupOrphanedRows } from "@/lib/demo/dependencies";

export const LOCAL_DB_BUCKET = "local-backups";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS local_documents (
  table_name text NOT NULL,
  row_id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, row_id)
);
CREATE TABLE IF NOT EXISTS local_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);
`;

type GlobalWithDb = typeof globalThis & {
  __miniAgniPglite?: Promise<PGlite>;
  __miniAgniCloseHooked?: boolean;
};

let dbPromise: Promise<PGlite> | null = null;
let hydratePromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function dataDir(): string {
  const custom = process.env.LOCAL_DB_DIR?.trim();
  const dir = custom
    ? path.isAbsolute(custom)
      ? custom
      : path.join(/* turbopackIgnore: true */ process.cwd(), custom)
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "pglite");
  return dir;
}

/**
 * Best-effort graceful close on normal process exit signals, so Postgres can
 * checkpoint and remove postmaster.pid. Hard kills (taskkill /F) can't be
 * caught — getLocalDb() self-heals from the resulting corruption instead.
 */
function registerCloseHook(db: PGlite): void {
  const g = globalThis as GlobalWithDb;
  if (g.__miniAgniCloseHooked) return;
  g.__miniAgniCloseHooked = true;

  process.once("exit", () => {
    void db.close().catch(() => {});
  });
  for (const [sig, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    process.once(sig, () => {
      void db
        .close()
        .catch(() => {})
        .finally(() => process.exit(code));
    });
  }
}

async function openPglite(): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.exec(SCHEMA);
  registerCloseHook(db);
  return db;
}

function quarantineCorruptDir(dir: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = `${dir}.corrupt-${stamp}`;
  fs.renameSync(dir, target);
  return target;
}

export function getLocalDb(): Promise<PGlite> {
  if (!dbPromise) {
    const g = globalThis as GlobalWithDb;
    // Share one instance across module copies (dev HMR can load db.ts twice).
    const init = (g.__miniAgniPglite ??= (async () => {
      try {
        return await openPglite();
      } catch (err) {
        // A hard kill can tear the WAL so badly Postgres panics on recovery
        // ("could not locate a valid checkpoint record"). Quarantine the
        // damaged directory and start a fresh one — hydrate() reseeds it.
        const dir = dataDir();
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[localdb] open failed (${reason}); quarantining ${dir}`);
        let quarantined: string;
        try {
          quarantined = quarantineCorruptDir(dir);
        } catch (renameErr) {
          // e.g. another live process still holds the directory — don't
          // destroy anything, just surface the original error.
          console.error(
            `[localdb] could not quarantine corrupt dir: ${
              renameErr instanceof Error ? renameErr.message : renameErr
            }`
          );
          throw err;
        }
        console.error(
          `[localdb] damaged data dir moved to ${quarantined}; reseeding fresh database`
        );
        return await openPglite();
      }
    })());
    dbPromise = init.catch((err) => {
      // Never cache a failed open — allow a retry on the next request.
      dbPromise = null;
      if (g.__miniAgniPglite === init) g.__miniAgniPglite = undefined;
      throw err;
    });
  }
  return dbPromise;
}

async function getMeta(db: PGlite, key: string): Promise<string | null> {
  const res = await db.query<{ value: string }>(
    "SELECT value FROM local_meta WHERE key = $1",
    [key]
  );
  return res.rows[0]?.value ?? null;
}

async function setMeta(db: PGlite, key: string, value: string): Promise<void> {
  await db.query(
    "INSERT INTO local_meta (key, value) VALUES ($1, $2) " +
      "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, value]
  );
}

async function writeTables(
  db: PGlite,
  tables: string[],
  rowOverrides?: Map<string, DemoRows>,
  markDirty = false
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of tables) {
      await tx.query("DELETE FROM local_documents WHERE table_name = $1", [table]);
      for (const row of rowOverrides?.get(table) ?? getTable(table)) {
        const id = row.id != null ? String(row.id) : crypto.randomUUID();
        await tx.query(
          "INSERT INTO local_documents (table_name, row_id, data) VALUES ($1, $2, $3)",
          [table, id, { ...row, id }]
        );
      }
    }
    if (markDirty) {
      const entries = [
        ["dirty", "1"],
        ["last_mutated_at", new Date().toISOString()],
      ];
      for (const [key, value] of entries) {
        await tx.query(
          "INSERT INTO local_meta (key, value) VALUES ($1, $2) " +
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
          [key, value]
        );
      }
    }
  });
  await db.exec("CHECKPOINT").catch((err) => {
    console.warn("[localdb] checkpoint failed after committed write", err);
  });
}

async function writeTable(db: PGlite, table: string, rows: DemoRows): Promise<void> {
  await writeTables(db, [table], new Map([[table, rows]]));
}

async function hydrate(db: PGlite): Promise<void> {
  const initializedRaw = await getMeta(db, "initialized_tables");
  const current = getStoreSnapshot();

  if (initializedRaw === null) {
    // First run — seed the local database from the demo store.
    for (const table of listTables()) {
      await writeTable(db, table, getTable(table));
    }
    await setMeta(db, "initialized_tables", JSON.stringify(listTables()));
    await setMeta(db, "seeded_at", new Date().toISOString());
    await setMeta(db, "dirty", "1");
    return;
  }

  const initialized = new Set<string>(JSON.parse(initializedRaw) as string[]);
  const docs = await db.query<{ table_name: string; data: Record<string, unknown> }>(
    "SELECT table_name, data FROM local_documents"
  );
  const grouped: Record<string, DemoRows> = {};
  for (const row of docs.rows) {
    const data =
      typeof row.data === "string"
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : row.data;
    (grouped[row.table_name] ??= []).push(data);
  }

  const newTables: string[] = [];
  for (const table of Object.keys(current)) {
    if (initialized.has(table)) {
      replaceTable(table, grouped[table] ?? []);
    } else {
      // Table added by a newer app version — seed it and remember it.
      newTables.push(table);
    }
  }

  if (newTables.length > 0) {
    for (const table of newTables) {
      await writeTable(db, table, getTable(table));
    }
    const merged = [...initialized, ...newTables];
    await setMeta(db, "initialized_tables", JSON.stringify(merged));
  }

  // Purge rows orphaned by pre-cascade deletes so the store stays consistent.
  const changed = cleanupOrphanedRows();
  if (changed.length > 0) {
    for (const table of changed) {
      await writeTable(db, table, getTable(table));
    }
    await setMeta(db, "dirty", "1");
    console.log(`[localdb] cleaned orphaned rows from: ${changed.join(", ")}`);
  }
}

/**
 * Opens the local PGlite database (persisted under .data/pglite) and loads
 * persisted rows into the in-memory store. Idempotent; safe to call on every
 * request.
 */
export async function ensureLocalDb(): Promise<PGlite> {
  const db = await getLocalDb();
  if (!hydratePromise) {
    hydratePromise = hydrate(db).catch((err) => {
      hydratePromise = null;
      throw err;
    });
  }
  await hydratePromise;
  return db;
}

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

/**
 * Persists a single table (full replace) and marks the database as dirty so
 * the scheduled backup picks it up.
 */
export function persistTable(table: string): Promise<void> {
  return persistTables([table]);
}

/** Persists related tables in one PGlite transaction. */
export function persistTables(tables: string[]): Promise<void> {
  return enqueue(async () => {
    const db = await getLocalDb();
    await writeTables(db, [...new Set(tables)], undefined, true);
  });
}

/** Persists every table in the store (used after snapshot restore/import). */
export function persistAllTables(): Promise<void> {
  return enqueue(async () => {
    const db = await getLocalDb();
    for (const table of listTables()) {
      await writeTable(db, table, getTable(table));
    }
    const initialized = await getMeta(db, "initialized_tables");
    const current = new Set<string>(
      initialized ? (JSON.parse(initialized) as string[]) : []
    );
    for (const table of listTables()) current.add(table);
    await setMeta(db, "initialized_tables", JSON.stringify([...current]));
    await setMeta(db, "dirty", "1");
    await setMeta(db, "last_mutated_at", new Date().toISOString());
  });
}

export async function getLocalMeta(key: string): Promise<string | null> {
  const db = await getLocalDb();
  return enqueue(async () => getMeta(db, key));
}

export async function setLocalMeta(key: string, value: string): Promise<void> {
  const db = await getLocalDb();
  return enqueue(async () => setMeta(db, key, value));
}

export async function isDirty(): Promise<boolean> {
  return (await getLocalMeta("dirty")) === "1";
}

export async function clearDirty(): Promise<void> {
  await setLocalMeta("dirty", "0");
}
