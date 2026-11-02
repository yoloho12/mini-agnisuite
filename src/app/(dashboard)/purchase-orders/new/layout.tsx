import { PURCHASE_ORDER_ROLES } from "@/lib/permissions";
import { requirePageRole } from "@/lib/routeGuards";

export default async function NewPurchaseOrderLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(PURCHASE_ORDER_ROLES);
  return children;
}
