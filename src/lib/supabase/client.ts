import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Browser code can only see NEXT_PUBLIC_* vars; the non-prefixed fallback
  // covers server-side renders of client components.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  return createBrowserClient(url!, key!);
}
