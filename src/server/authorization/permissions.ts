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
  "reservations.view",
  "reservations.create",
  "reservations.update",
  "reservations.cancel",
  "reservations.confirm",
  "reservations.submit",
  "reservations.approve",
  "reservations.reject",
  "reservations.mark_urgent",
  "pickups.view", "pickups.start", "pickups.inspect", "pickups.complete", "pickups.refuse", "pickups.view_evidence", "pickups.add_evidence",
  "pickups.acceptance.view", "pickups.acceptance.create", "pickups.acceptance.request_otp", "pickups.acceptance.verify", "pickups.acceptance.capture_signature",
  "returns.view", "returns.start", "returns.inspect", "returns.complete", "returns.cancel", "returns.add_evidence", "returns.view_evidence",
  "maintenance.view", "maintenance.create", "maintenance.update", "maintenance.diagnose", "maintenance.perform", "maintenance.complete", "maintenance.release", "maintenance.cancel", "maintenance.add_evidence", "maintenance.view_evidence",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const INITIAL_ROLE_MATRIX: Record<"tenant-admin" | "manager" | "supervisor" | "operator" | "gate-operator", readonly Permission[]> = {
  "tenant-admin": PERMISSIONS,
  manager: [
    "tenant.view", "users.view", "memberships.view",
    "units.view", "units.create", "units.update",
    "customers.view", "customers.create", "customers.update",
    "contracts.view", "contracts.create", "contracts.update",
    "resources.view", "resources.create", "resources.update",
    "resource_categories.view", "resource_categories.manage",
    "reservations.view", "reservations.create", "reservations.update", "reservations.cancel", "reservations.confirm", "reservations.submit", "reservations.approve", "reservations.reject", "reservations.mark_urgent",
    "pickups.view", "pickups.start", "pickups.inspect", "pickups.complete", "pickups.refuse", "pickups.view_evidence", "pickups.add_evidence",
    "pickups.acceptance.view", "pickups.acceptance.create", "pickups.acceptance.request_otp", "pickups.acceptance.verify", "pickups.acceptance.capture_signature",
    "returns.view", "returns.start", "returns.inspect", "returns.complete", "returns.cancel", "returns.add_evidence", "returns.view_evidence",
    "maintenance.view", "maintenance.create", "maintenance.update", "maintenance.diagnose", "maintenance.perform", "maintenance.complete", "maintenance.release", "maintenance.cancel", "maintenance.add_evidence", "maintenance.view_evidence",
  ],
  supervisor: [
    "tenant.view", "users.view", "units.view", "customers.view",
    "contracts.view", "resources.view", "resources.update", "resource_categories.view",
    "reservations.view", "reservations.create", "reservations.update", "reservations.submit", "reservations.mark_urgent",
    "pickups.view", "pickups.inspect", "returns.view", "returns.start", "returns.inspect", "returns.complete", "returns.add_evidence", "returns.view_evidence",
    "maintenance.view", "maintenance.create", "maintenance.update", "maintenance.diagnose", "maintenance.perform", "maintenance.complete", "maintenance.add_evidence", "maintenance.view_evidence",
  ],
  operator: [
    "tenant.view", "units.view", "customers.view", "contracts.view",
    "resources.view", "resource_categories.view",
    "reservations.view", "reservations.create", "reservations.update", "reservations.submit",
  ],
  "gate-operator": ["tenant.view", "reservations.view", "resources.view", "pickups.view", "pickups.start", "pickups.inspect", "pickups.complete", "pickups.refuse", "pickups.view_evidence", "pickups.add_evidence", "pickups.acceptance.view", "pickups.acceptance.create", "pickups.acceptance.request_otp", "pickups.acceptance.verify", "pickups.acceptance.capture_signature", "returns.view", "returns.start", "returns.inspect", "returns.complete", "returns.add_evidence", "returns.view_evidence"],
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
