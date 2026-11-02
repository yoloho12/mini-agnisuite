import { createDemoClient, type DemoClient } from "@/lib/demo/demoClient";
import { ensureLocalDb, persistTables } from "./db";

let ready: Promise<unknown> | null = null;

/**
 * Local-first Supabase-compatible client:
 * - reads hit the in-memory store (hydrated from the on-disk PGlite database)
 * - writes are written through to PGlite immediately
 * - the scheduled/manual backup then pushes PGlite state to Supabase Storage
 */
export async function createLocalClient(): Promise<DemoClient> {
  if (!ready) {
    ready = ensureLocalDb().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;

  return createDemoClient((tables) => persistTables(tables));
}
