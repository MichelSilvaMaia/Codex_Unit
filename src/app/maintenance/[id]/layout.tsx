import type { ReactNode } from "react";
import { OfflineMaintenanceForm } from "@/components/offline/offline-maintenance-form";
import { OfflineMaintenanceEvidence } from "@/components/offline/offline-maintenance-evidence";
import { getMaintenanceOrder } from "@/server/maintenance/maintenance-service";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";
import { hasPermission } from "@/server/authorization/permissions";

export default async function MaintenanceDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const context = await requireActiveTenantForPage();
  const { id } = await params;
  const { order } = await getMaintenanceOrder(context, id);
  const canDiagnose = hasPermission(context.permissions, "maintenance.diagnose"), canPerform = hasPermission(context.permissions, "maintenance.perform");
  return <>{children}{(canDiagnose || canPerform || hasPermission(context.permissions,"maintenance.add_evidence")) && <div className="mx-auto grid max-w-6xl gap-4 px-5 pb-10">{(canDiagnose || canPerform)&&<OfflineMaintenanceForm tenantId={context.tenantId} userId={context.user.id} orderId={id} expectedVersion={order.version} canDiagnose={canDiagnose} canPerform={canPerform}/ >}{hasPermission(context.permissions,"maintenance.add_evidence")&&<OfflineMaintenanceEvidence tenantId={context.tenantId} userId={context.user.id} orderId={id} expectedVersion={order.version}/>}</div>}</>;
}
