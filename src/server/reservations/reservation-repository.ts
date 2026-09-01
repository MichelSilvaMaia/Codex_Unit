import { Prisma, type ReservationStatus } from "@prisma/client";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { BLOCKING_RESERVATION_STATUSES } from "./reservation-policy";

export type ReservationTx = Prisma.TransactionClient;

export function reservationNotFound() {
  return new AppError("NOT_FOUND", "Reserva ou relacionamento não encontrado.");
}

export function reservationConflict() {
  return new AppError("CONFLICT", "Um ou mais recursos deixaram de estar disponíveis para o período selecionado.");
}

export function mapReservationError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2004", "P2034"].includes(error.code)) throw reservationConflict();
  if (error instanceof Error && /ReservationItem_no_blocking_overlap|exclusion constraint|40P01|deadlock|impasse detectado/i.test(error.message)) throw reservationConflict();
  throw error;
}

export async function getTenantTimeZone(tx: ReservationTx, tenantId: string) {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { timeZone: true } });
  if (!tenant) throw reservationNotFound();
  return tenant.timeZone;
}

export async function validateReservationReferences(tx: ReservationTx, context: OperationalContext, input: { customerId: string; contractId?: string; unitId: string; resourceIds: string[]; startAt: Date; endAt: Date }) {
  const resourceIds = [...new Set(input.resourceIds)];
  const [customer, unit, resources] = await Promise.all([
    tx.customer.findFirst({ where: { id: input.customerId, tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true } }),
    tx.unit.findFirst({ where: { id: input.unitId, tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true } }),
    tx.resource.findMany({ where: { id: { in: resourceIds }, tenantId: context.tenantId, unitId: input.unitId, status: "ACTIVE", operationalStatus: "AVAILABLE" }, select: { id: true } }),
  ]);
  if (!customer || !unit || resources.length !== resourceIds.length) throw reservationNotFound();
  if (input.contractId) {
    const contract = await tx.contract.findFirst({
      where: { id: input.contractId, tenantId: context.tenantId, customerId: input.customerId, status: "ACTIVE" },
      select: { startDate: true, endDate: true, _count: { select: { units: true } }, units: { where: { unitId: input.unitId }, select: { unitId: true } } },
    });
    const contractEndExclusive = contract?.endDate ? new Date(contract.endDate.valueOf() + 86_400_000) : undefined;
    if (!contract || input.startAt < contract.startDate || (contractEndExclusive && input.endAt > contractEndExclusive) || (contract._count.units > 0 && contract.units.length === 0)) throw reservationNotFound();
  }
  return resourceIds;
}

export async function validateAvailableResources(tx: ReservationTx, tenantId: string, unitId: string, requestedIds: string[]) {
  const resourceIds = [...new Set(requestedIds)];
  const [unit, resources] = await Promise.all([
    tx.unit.findFirst({ where: { id: unitId, tenantId, status: "ACTIVE" }, select: { id: true } }),
    tx.resource.findMany({ where: { id: { in: resourceIds }, tenantId, unitId, status: "ACTIVE", operationalStatus: "AVAILABLE" }, select: { id: true } }),
  ]);
  if (!unit || resources.length !== resourceIds.length) throw reservationNotFound();
  return resourceIds;
}

export async function findBlockingResourceIds(tx: ReservationTx, tenantId: string, resourceIds: string[], startAt: Date, endAt: Date, reservationId?: string) {
  const conflicts = await tx.reservationItem.findMany({
    where: {
      tenantId,
      resourceId: { in: resourceIds },
      status: { in: [...BLOCKING_RESERVATION_STATUSES] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(reservationId ? { reservationId: { not: reservationId } } : {}),
    },
    select: { resourceId: true },
    distinct: ["resourceId"],
  });
  return conflicts.map(({ resourceId }) => resourceId);
}

export function reservationAudit(context: OperationalContext, action: string, reservationId: string, metadata?: Prisma.InputJsonValue) {
  return { scope: "TENANT" as const, tenantId: context.tenantId, actorUserId: context.user.id, action, entityType: "Reservation", entityId: reservationId, metadata };
}

export function transitionPermission(status: ReservationStatus) {
  return status === "CONFIRMED" ? "reservations.confirm" as const : status === "CANCELLED" ? "reservations.cancel" as const : "reservations.update" as const;
}
