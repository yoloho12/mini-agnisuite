import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canRole } from "@/lib/permissions";
import type { UserRole } from "@/types";

/**
 * Server-side guard for role-restricted pages. The client RoleGuard is
 * responsible for the visible UI, while this prevents the route (and its
 * server rendering) from being reached at all.
 */
export async function requirePageRole(allowed: readonly UserRole[]): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canRole(user.role, allowed)) redirect("/");
}
