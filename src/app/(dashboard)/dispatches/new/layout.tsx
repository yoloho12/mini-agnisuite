import { DISPATCH_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

export default async function NewDispatchLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(DISPATCH_ROLES);
  return children;
}
