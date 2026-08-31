import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
import { requirePermission, type Permission } from "./permissions";

export async function requireAuthorization(permission: Permission) {
  const context = await getActiveTenantContext();
  requirePermission(context.permissions, permission);
  return context;
}
