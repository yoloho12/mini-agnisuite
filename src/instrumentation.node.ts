function backupIntervalMs(): number {
  const raw = Number(process.env.BACKUP_INTERVAL_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) return 15 * 60 * 1000;
  return raw * 60 * 1000;
}

const INITIAL_DELAY_MS = 60 * 1000;

type GlobalWithTimer = typeof globalThis & {
  __miniAgniBackupTimer?: ReturnType<typeof setInterval>;
};

async function tick(): Promise<void> {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS !== "true") return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return;

  try {
    const { isDirty, ensureLocalDb } = await import("@/lib/localdb/db");
    await ensureLocalDb();
    if (!(await isDirty())) return;

    const { backupToSupabase } = await import("@/lib/localdb/backup");
    const result = await backupToSupabase();
    if (result.ok) {
      console.log(`[backup] auto-backup OK — ${result.message}`);
    } else {
      console.warn(`[backup] auto-backup failed — ${result.message}`);
    }
  } catch (err) {
    console.warn("[backup] auto-backup error:", err);
  }
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PUBLIC_DEV_BYPASS !== "true") return;

  const g = globalThis as GlobalWithTimer;
  if (g.__miniAgniBackupTimer) return;

  g.__miniAgniBackupTimer = setInterval(() => {
    void tick();
  }, backupIntervalMs());

  const initial = setTimeout(() => {
    void tick();
  }, INITIAL_DELAY_MS);
  unref(g.__miniAgniBackupTimer);
  unref(initial);
}

function unref(t: unknown): void {
  const maybe = t as { unref?: () => void };
  if (typeof maybe?.unref === "function") maybe.unref();
}
