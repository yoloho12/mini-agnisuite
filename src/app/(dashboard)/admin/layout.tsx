import { ADMIN_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

/** The admin panel, including any future subpages, is owner-only. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(ADMIN_ROLES);
  return children;
}
