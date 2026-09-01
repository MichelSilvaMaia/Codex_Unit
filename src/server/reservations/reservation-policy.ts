import type { ReservationStatus } from "@prisma/client";
import { AppError } from "@/server/errors/app-error";

export const BLOCKING_RESERVATION_STATUSES = new Set<ReservationStatus>(["PENDING_APPROVAL", "APPROVED", "CONFIRMED", "READY_FOR_PICKUP", "RELEASED"]);

export const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CONFIRMED", "CANCELLED"],
  REJECTED: ["DRAFT"],
  CONFIRMED: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["RELEASED", "CANCELLED"],
  RELEASED: [],
  CANCELLED: [],
};

export function intervalsOverlap(existingStart: Date, existingEnd: Date, requestedStart: Date, requestedEnd: Date) {
  return existingStart < requestedEnd && existingEnd > requestedStart;
}

export function reservationBlocksAvailability(status: ReservationStatus) {
  return BLOCKING_RESERVATION_STATUSES.has(status);
}

export function requireValidPeriod(startAt: Date, endAt: Date) {
  if (!(startAt instanceof Date) || !(endAt instanceof Date) || Number.isNaN(startAt.valueOf()) || Number.isNaN(endAt.valueOf()) || endAt <= startAt) {
    throw new AppError("VALIDATION_ERROR", "O término deve ser posterior ao início.");
  }
}

export function requireReservationTransition(from: ReservationStatus, to: ReservationStatus) {
  if (!RESERVATION_TRANSITIONS[from].includes(to)) throw new AppError("CONFLICT", `Transição de ${from} para ${to} não permitida.`);
}
