import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  verifyCredentials,
  createContextClient,
  createAdminClient,
} from "@supabase/server/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseEnv, AuthModeWithKey, SupabaseContext } from "@supabase/server";

function resolveEnv(): Partial<SupabaseEnv> {
  return {
    url: process.env.SUPABASE_URL,
    publishableKeys: process.env.SUPABASE_PUBLISHABLE_KEY
      ? { default: process.env.SUPABASE_PUBLISHABLE_KEY }
      : {},
    secretKeys: process.env.SUPABASE_SECRET_KEY
      ? { default: process.env.SUPABASE_SECRET_KEY }
      : {},
  };
}

let cachedJwks: SupabaseEnv["jwks"] = null;

async function getJwks(supabaseUrl: string): Promise<SupabaseEnv["jwks"]> {
  if (cachedJwks) return cachedJwks;
  try {
    const res = await fetch(
      process.env.SUPABASE_JWKS_URL ??
        `${supabaseUrl}/auth/v1/.well-known/jwks.json`
    );
    if (!res.ok) return null;
    cachedJwks = await res.json();
    return cachedJwks;
  } catch {
    return null;
  }
}

export async function createSupabaseContext(
  options: { auth?: AuthModeWithKey | AuthModeWithKey[] } = { auth: "user" }
): Promise<
  | { data: SupabaseContext; error: null }
  | { data: null; error: Error }
> {
  const nextEnv = resolveEnv();

  if (!nextEnv.url || !nextEnv.publishableKeys?.default) {
    return {
      data: null,
      error: new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY"),
    };
  }

  const cookieStore = await cookies();
  const ssrClient = createServerClient(
    nextEnv.url,
    nextEnv.publishableKeys.default,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can't write cookies
          }
        },
      },
    }
  );

  const {
    data: { session },
  } = await ssrClient.auth.getSession();
  const token = session?.access_token ?? null;

  const jwks = await getJwks(nextEnv.url);
  const env: Partial<SupabaseEnv> = { ...nextEnv, jwks };

  const { data: auth, error } = await verifyCredentials(
    { token, apikey: null },
    { auth: options.auth ?? "user", env }
  );

  if (error) {
    return { data: null, error };
  }

  const supabase = createContextClient({
    auth: { token: auth!.token },
    env,
  });
  const supabaseAdmin = createAdminClient({ env });

  return {
    data: {
      supabase,
      supabaseAdmin,
      userClaims: auth!.userClaims,
      jwtClaims: auth!.jwtClaims,
      authMode: auth!.authMode,
    },
    error: null,
  };
}

// Convenience: get a regular supabase client (RLS-scoped, for Server Components)
export async function createClient() {
  const cookieStore = await cookies();

  // Local-first mode — data lives in a local PGlite database, backed up to
  // Supabase Storage. Activated by the dev-bypass cookie (auto-set by middleware).
  if (
    process.env.NEXT_PUBLIC_DEV_BYPASS === "true" &&
    cookieStore.get("dev-bypass-user")
  ) {
    const { createLocalClient } = await import("@/lib/localdb/localClient");
    return await createLocalClient();
  }

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}

export async function createPrivilegedClient(): Promise<SupabaseClient> {
  const context = await createSupabaseContext();
  if (!context.data) throw context.error;
  return context.data.supabaseAdmin as unknown as SupabaseClient;
}
