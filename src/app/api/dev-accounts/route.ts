import { NextResponse } from "next/server";
import { createLocalClient } from "@/lib/localdb/localClient";
import { DEFAULT_DEV_ORG_ID, DEV_ACCOUNTS } from "@/lib/demo/devAccounts";

/**
 * Dev-only account directory used by the Topbar account switcher. Reads the
 * local demo store so accounts created from the admin panel show up without a
 * rebuild.
 */
export async function GET() {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const client = await createLocalClient();
    const [{ data: profiles }, { data: memberships }] = await Promise.all([
      client.from("profiles").select("*"),
      client.from("org_users").select("*"),
    ]);

    const profileMap = new Map<string, Record<string, unknown>>();
    for (const profile of (profiles ?? []) as Array<Record<string, unknown>>) {
      profileMap.set(String(profile.id), profile);
    }
    const staticById = new Map(DEV_ACCOUNTS.map((account) => [account.id, account]));

    const accounts: Array<{
      id: string;
      email: string;
      full_name: string;
      role: string;
      org_id: string;
      site_id: string | null;
      signature: string | null;
    }> = [];
    const seen = new Set<string>();

    for (const membership of (memberships ?? []) as Array<Record<string, unknown>>) {
      const id = String(membership.user_id ?? "");
      if (!id || seen.has(id)) continue;
      const profile = profileMap.get(id);
      const staticAccount = staticById.get(id);
      if (!profile && !staticAccount) continue;
      seen.add(id);
      accounts.push({
        id,
        email: String(profile?.email ?? staticAccount?.email ?? ""),
        full_name: String(profile?.full_name ?? staticAccount?.full_name ?? ""),
        role: String(membership.role ?? profile?.role ?? staticAccount?.role ?? "viewer"),
        org_id: String(membership.org_id ?? staticAccount?.org_id ?? DEFAULT_DEV_ORG_ID),
        site_id:
          (profile?.site_id as string | null | undefined) ??
          staticAccount?.site_id ??
          null,
        signature:
          (profile?.signature as string | null | undefined) ??
          staticAccount?.signature ??
          null,
      });
    }

    // Never leave the switcher empty if the local store hasn't hydrated yet.
    if (accounts.length === 0) {
      for (const account of DEV_ACCOUNTS) {
        accounts.push({ ...account });
      }
    }

    const rank: Record<string, number> = {
      owner: 0,
      manager: 1,
      staff_warehouse: 2,
      staff_site: 3,
      viewer: 4,
    };
    accounts.sort((a, b) => {
      const byRole = (rank[a.role] ?? 9) - (rank[b.role] ?? 9);
      if (byRole !== 0) return byRole;
      return (a.full_name || a.email).localeCompare(b.full_name || b.email);
    });

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("[dev-accounts] failed to load local accounts:", err);
    return NextResponse.json({ accounts: DEV_ACCOUNTS.map((account) => ({ ...account })) });
  }
}
