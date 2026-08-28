import { AppError } from "@/server/errors/app-error";

export type Permission =
  | "tenant.read"
  | "tenant.manage"
  | "membership.read"
  | "membership.manage"
  | "audit.read";

export function hasPermission(granted: ReadonlySet<Permission>, required: Permission) {
  return granted.has(required);
}

export function requirePermission(granted: ReadonlySet<Permission>, required: Permission) {
  if (!hasPermission(granted, required)) {
    throw new AppError("FORBIDDEN", "Você não possui permissão para esta ação.");
  }
}
