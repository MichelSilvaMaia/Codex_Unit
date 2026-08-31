import { AppError } from "@/server/errors/app-error";

export const PERMISSIONS = [
  "tenant.view",
  "tenant.settings.manage",
  "users.view",
  "users.create",
  "users.update",
  "users.disable",
  "roles.view",
  "roles.manage",
  "memberships.view",
  "memberships.manage",
  "units.view",
  "units.create",
  "units.update",
  "units.disable",
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.disable",
  "contracts.view",
  "contracts.create",
  "contracts.update",
  "contracts.disable",
  "resources.view",
  "resources.create",
  "resources.update",
  "resources.disable",
  "resource_categories.view",
  "resource_categories.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const INITIAL_ROLE_MATRIX: Record<"tenant-admin" | "manager" | "supervisor" | "operator", readonly Permission[]> = {
  "tenant-admin": PERMISSIONS,
  manager: [
    "tenant.view", "users.view", "memberships.view",
    "units.view", "units.create", "units.update",
    "customers.view", "customers.create", "customers.update",
    "contracts.view", "contracts.create", "contracts.update",
    "resources.view", "resources.create", "resources.update",
    "resource_categories.view", "resource_categories.manage",
  ],
  supervisor: [
    "tenant.view", "users.view", "units.view", "customers.view",
    "contracts.view", "resources.view", "resources.update", "resource_categories.view",
  ],
  operator: [
    "tenant.view", "units.view", "customers.view", "contracts.view",
    "resources.view", "resource_categories.view",
  ],
};

export function hasPermission(granted: ReadonlySet<string>, required: Permission) {
  return granted.has(required);
}

export function requirePermission(granted: ReadonlySet<string>, required: Permission) {
  if (!hasPermission(granted, required)) {
    throw new AppError("FORBIDDEN", "Você não possui permissão para esta ação.");
  }
}

export function requireTenantScopedPermission(
  context: { tenantId: string; permissions: ReadonlySet<string> },
  resourceTenantId: string,
  required: Permission,
) {
  if (context.tenantId !== resourceTenantId) {
    throw new AppError("NOT_FOUND", "Recurso não encontrado.");
  }
  requirePermission(context.permissions, required);
}
