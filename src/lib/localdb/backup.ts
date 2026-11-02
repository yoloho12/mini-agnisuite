import { getStoreSnapshot, type DemoStore } from "@/lib/demo/data";
import {
  ensureLocalDb,
  getLocalMeta,
  setLocalMeta,
  clearDirty,
  isDirty,
  LOCAL_DB_BUCKET,
} from "./db";

export interface BackupSnapshot {
  app: "mini-agnisuite";
  version: 1;
  exported_at: string;
  tables: DemoStore;
}

export type BackupResult = {
  ok: boolean;
  message: string;
  backupKey?: string;
  rowCount?: number;
};

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return { url, key };
}

export function backupConfigured(): boolean {
  const { url, key } = env();
  return Boolean(url && key);
}

export async function ensureLocalReady(): Promise<void> {
  await ensureLocalDb();
}

export function buildSnapshot(): BackupSnapshot {
  const tables = getStoreSnapshot();
  return {
    app: "mini-agnisuite",
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  };
}

function storageHeaders(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function ensureBucket(url: string, key: string): Promise<void> {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders(key),
    body: JSON.stringify({
      id: LOCAL_DB_BUCKET,
      name: "Local DB Backups",
      public: false,
      fileSizeLimit: 52428800,
    }),
  });
  // 409 = already exists, anything else non-ok we still try the upload.
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => "");
    console.warn("[backup] bucket create:", res.status, text.slice(0, 200));
  }
}

/**
 * Pushes the entire local database to Supabase Storage as a JSON snapshot.
 * Stores both `latest.json` and a timestamped copy for history.
 */
export async function backupToSupabase(): Promise<BackupResult> {
  const { url, key } = env();
  if (!url || !key) {
    return {
      ok: false,
      message: "Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY missing).",
    };
  }

  try {
    await ensureLocalReady();
    const snapshot = buildSnapshot();
    const body = JSON.stringify(snapshot);
    let rowCount = 0;
    for (const rows of Object.values(snapshot.tables)) rowCount += rows.length;

    await ensureBucket(url, key);

    const stamp = snapshot.exported_at.replace(/[:.]/g, "-");
    const backupKey = `backups/${stamp}.json`;

    const uploads = [
      { path: backupKey, body },
      { path: "latest.json", body },
    ];

    for (const u of uploads) {
      const res = await fetch(
        `${url}/storage/v1/object/${LOCAL_DB_BUCKET}/${u.path}`,
        {
          method: "POST",
          headers: storageHeaders(key, {
            "x-upsert": "true",
          }),
          body: u.body,
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          message: `Upload failed (${res.status}): ${text.slice(0, 300)}`,
        };
      }
    }

    await setLocalMeta("last_backup_at", snapshot.exported_at);
    await setLocalMeta("last_backup_key", backupKey);
    await setLocalMeta("last_backup_error", "");
    await clearDirty();

    return {
      ok: true,
      message: `Backed up ${rowCount} rows to Supabase Storage.`,
      backupKey,
      rowCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setLocalMeta("last_backup_error", message).catch(() => undefined);
    return { ok: false, message };
  }
}

/**
 * Downloads the latest snapshot from Supabase Storage and restores it into
 * the local database (overwriting local rows).
 */
export async function restoreFromSupabase(): Promise<BackupResult> {
  const { url, key } = env();
  if (!url || !key) {
    return {
      ok: false,
      message: "Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY missing).",
    };
  }

  try {
    const res = await fetch(
      `${url}/storage/v1/object/${LOCAL_DB_BUCKET}/latest.json`,
      { method: "GET", headers: storageHeaders(key) }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        message: `No backup found (HTTP ${res.status}): ${text.slice(0, 200)}`,
      };
    }

    const snapshot = (await res.json()) as BackupSnapshot;
    if (!snapshot || snapshot.app !== "mini-agnisuite" || !snapshot.tables) {
      return { ok: false, message: "Backup file is not a valid Mini-AgniSuite snapshot." };
    }

    await applySnapshot(snapshot);

    let rowCount = 0;
    for (const rows of Object.values(snapshot.tables)) rowCount += rows.length;
    return {
      ok: true,
      message: `Restored ${rowCount} rows from Supabase backup (${snapshot.exported_at}).`,
      rowCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

async function applySnapshot(snapshot: BackupSnapshot): Promise<void> {
  const { replaceTable, listTables } = await import("@/lib/demo/data");
  const { persistAllTables } = await import("./db");

  const names = new Set([...listTables(), ...Object.keys(snapshot.tables)]);
  for (const name of names) {
    replaceTable(name, snapshot.tables[name] ?? []);
  }
  await persistAllTables();
  await setLocalMeta("last_restored_at", new Date().toISOString());
  await setLocalMeta("dirty", "1");
}

export async function getBackupStatus(): Promise<{
  configured: boolean;
  dirty: boolean;
  lastBackupAt: string | null;
  lastBackupKey: string | null;
  lastBackupError: string | null;
  lastRestoredAt: string | null;
}> {
  await ensureLocalReady();
  const dirty = await isDirty().catch(() => true);
  return {
    configured: backupConfigured(),
    dirty,
    lastBackupAt: (await getLocalMeta("last_backup_at").catch(() => null)) ?? null,
    lastBackupKey: (await getLocalMeta("last_backup_key").catch(() => null)) ?? null,
    lastBackupError:
      (await getLocalMeta("last_backup_error").catch(() => null)) || null,
    lastRestoredAt: (await getLocalMeta("last_restored_at").catch(() => null)) ?? null,
  };
}

/** Full snapshot for browser download (no Supabase required). */
export async function exportSnapshotJson(): Promise<string> {
  await ensureLocalReady();
  return JSON.stringify(buildSnapshot(), null, 2);
}

/** Restore from a JSON file the user picked in the browser. */
export async function importSnapshotJson(json: string): Promise<BackupResult> {
  try {
    const snapshot = JSON.parse(json) as BackupSnapshot;
    if (!snapshot || snapshot.app !== "mini-agnisuite" || !snapshot.tables) {
      return { ok: false, message: "Not a valid Mini-AgniSuite backup file." };
    }
    await ensureLocalReady();
    await applySnapshot(snapshot);
    let rowCount = 0;
    for (const rows of Object.values(snapshot.tables)) rowCount += rows.length;
    return { ok: true, message: `Imported ${rowCount} rows.`, rowCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
