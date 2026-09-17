import type { ReactNode } from "react";
import { OfflineMaintenanceForm } from "@/components/offline/offline-maintenance-form";
import { getMaintenanceOrder } from "@/server/maintenance/maintenance-service";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export default async function MaintenanceDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const context = await requireActiveTenantForPage();
  const { id } = await params;
  const { order } = await getMaintenanceOrder(context, id);
  return <>{children}<div className="mx-auto max-w-6xl px-5 pb-10"><OfflineMaintenanceForm tenantId={context.tenantId} userId={context.user.id} orderId={id} expectedVersion={order.version}/></div></>;
}
