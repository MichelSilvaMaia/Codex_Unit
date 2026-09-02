import type { MaintenanceStatus } from "@prisma/client";
import { AppError } from "@/server/errors/app-error";

export const ACTIVE_MAINTENANCE_STATUSES: MaintenanceStatus[] = ["OPEN", "DIAGNOSING", "IN_PROGRESS", "WAITING", "COMPLETED"];
const transitions: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  OPEN: ["DIAGNOSING", "IN_PROGRESS", "CANCELLED"], DIAGNOSING: ["IN_PROGRESS", "WAITING", "CANCELLED"],
  IN_PROGRESS: ["WAITING", "COMPLETED"], WAITING: ["IN_PROGRESS", "CANCELLED"], COMPLETED: ["RELEASED"], RELEASED: [], CANCELLED: [],
};
export function assertMaintenanceTransition(from: MaintenanceStatus, to: MaintenanceStatus) {
  if (!transitions[from].includes(to)) throw new AppError("CONFLICT", `Transição de manutenção inválida: ${from} → ${to}.`);
}
