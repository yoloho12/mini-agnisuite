/**
 * Thrown when a delete is blocked because the record is still referenced by
 * other data. `message` is already user-facing and safe to display.
 */
export class DependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependencyError";
  }
}

/**
 * Turns unknown thrown errors (server actions, fetch failures, PGlite panics,
 * FK violations) into short messages that are safe and useful to show to users.
 */
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DependencyError) return err.message;

  // Supabase/PostgREST errors are plain objects ({ message, code, ... }), not Error instances.
  const obj = err && typeof err === "object" ? (err as { message?: unknown; code?: unknown }) : null;
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : typeof obj?.message === "string"
          ? obj.message
          : "";
  const msg = raw.trim();

  // Postgres foreign-key violation (real Supabase mode) — same semantics as DependencyError.
  if (obj && obj.code === "23503") {
    return "This record is linked to other data and can't be deleted.";
  }

  if (!msg) return fallback;

  // Infrastructure / database failures — don't leak internals.
  if (/aborted|panic|assertions|checkpoint|wasm/i.test(msg)) {
    return "The local database hit a problem and is recovering. Please try again in a moment.";
  }
  if (/fetch failed|network|econnrefused|enotfound|dns/i.test(msg)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  // Supabase constraint / validation messages are fine to surface verbatim
  // (they are already user-oriented), but keep them short.
  if (msg.length <= 160) return msg;

  return fallback;
}
