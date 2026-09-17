import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
import { SyncIndicator } from "./sync-indicator";
export async function SyncIdentity() {
  const context = await getActiveTenantContext();
  return <SyncIndicator tenantId={context.tenantId} userId={context.user.id}/>;
}
