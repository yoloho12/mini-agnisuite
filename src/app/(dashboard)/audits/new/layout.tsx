import { AUDIT_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

export default async function NewAuditLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(AUDIT_ROLES);
  return children;
}
