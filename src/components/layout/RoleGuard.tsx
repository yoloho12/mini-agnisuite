"use client";

import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canAccessRoute, ROLE_LABELS } from "@/lib/permissions";

/**
 * Blocks the page content for roles that are not allowed on the current route.
 * Server layouts add a second guard for the restricted create routes; server
 * actions remain the final authority for all writes.
 */
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const allowed = canAccessRoute(pathname, user?.role);
  if (allowed) return <>{children}</>;

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10">
        <ShieldAlert size={28} className="text-danger" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
      <p className="mt-1 mb-6 max-w-sm text-sm text-muted">
        {user
          ? `Your role (${ROLE_LABELS[user.role]}) does not have access to this page.`
          : "You do not have access to this page."}
      </p>
      <Button onClick={() => router.push("/")}>Back to dashboard</Button>
    </div>
  );
}
