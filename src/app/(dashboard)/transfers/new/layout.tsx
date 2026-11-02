import { TRANSFER_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

export default async function NewTransferLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(TRANSFER_ROLES);
  return children;
}
