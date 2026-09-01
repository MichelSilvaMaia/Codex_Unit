import type { ReservationStatus } from "@prisma/client";
import { AppError } from "@/server/errors/app-error";
export const PICKUP_ELIGIBLE_STATUSES = new Set<ReservationStatus>(["CONFIRMED", "READY_FOR_PICKUP"]);
export function requirePickupEligibility(status: ReservationStatus, startAt: Date, now = new Date()) {
  if (!PICKUP_ELIGIBLE_STATUSES.has(status)) throw new AppError("CONFLICT", "A reserva não está apta para retirada.");
  if (now < startAt) throw new AppError("CONFLICT", "Retirada antecipada não está autorizada nesta fase.");
}
