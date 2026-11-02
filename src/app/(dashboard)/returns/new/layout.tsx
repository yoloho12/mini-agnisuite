import { SUPPLIER_RETURN_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

export default async function NewSupplierReturnLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(SUPPLIER_RETURN_ROLES);
  return children;
}
