import { SITE_RETURN_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

export default async function NewSiteReturnLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(SITE_RETURN_ROLES);
  return children;
}
