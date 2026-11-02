import { WRITE_OFF_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

export default async function NewWriteOffLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(WRITE_OFF_ROLES);
  return children;
}
