import { NextResponse } from "next/server";
import { DEV_ACCOUNTS } from "@/lib/demo/devAccounts";
import { createLocalClient } from "@/lib/localdb/localClient";

// Dev-only bypass — sets a mock session cookie.
// REMOVE this file before production deployment.

interface ResolvedDevAccount {
  id: string;
  email: string;
  full_name: string;
  role: string;
  org_id: string;
  site_id: string | null;
  signature: string | null;
}

/**
 * Resolve a demo account from the local store so dynamically created accounts
 * (and permission edits) are reflected immediately. Accounts whose membership
 * was removed cannot be selected again.
 */
async function resolveDevAccount(userId: string): Promise<ResolvedDevAccount | null> {
  const staticAccount = DEV_ACCOUNTS.find((account) => account.id === userId);

  try {
    const client = await createLocalClient();
    const [{ data: profile }, { data: membership }] = await Promise.all([
      client.from("profiles").select("*").eq("id", userId).maybeSingle(),
      client.from("org_users").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (profile) {
      if (!membership) return null;
      return {
        id: userId,
        email: String(profile.email ?? staticAccount?.email ?? ""),
        full_name: String(profile.full_name ?? staticAccount?.full_name ?? ""),
        role: String(membership.role ?? "viewer"),
        org_id: String(membership.org_id),
        site_id: (profile.site_id as string | null | undefined) ?? null,
        signature: (profile.signature as string | null | undefined) ?? null,
      };
    }
  } catch (err) {
    console.error("[dev-bypass] local account lookup failed:", err);
  }

  return staticAccount ?? null;
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let userId = "dev-user-000";
  try {
    const body = await request.json();
    if (typeof body.userId === "string") userId = body.userId;
  } catch {
    // Empty body selects the default demo owner for the login bypass.
  }

  const mockUser = await resolveDevAccount(userId);
  if (!mockUser) {
    return NextResponse.json({ error: "Unknown demo account" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, user: mockUser });

  // Keep the cookie small: drawn signatures are base64 images and can push
  // the header past the browser's ~4 KB limit. The signature still resolves
  // from the profile (or the static demo account) in getCurrentUser.
  const cookieUser = {
    id: mockUser.id,
    email: mockUser.email,
    full_name: mockUser.full_name,
    role: mockUser.role,
    org_id: mockUser.org_id,
    site_id: mockUser.site_id,
  };

  response.cookies.set("dev-bypass-user", JSON.stringify(cookieUser), {
    // Not httpOnly: client code reads this cookie via document.cookie.
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}
