import { randomBytes } from "node:crypto";
import { Prisma, type ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { requireReservationTransition, requireValidPeriod, reservationBlocksAvailability } from "./reservation-policy";
import {
  findBlockingResourceIds, getTenantTimeZone, mapReservationError, reservationAudit,
  reservationConflict, reservationNotFound, transitionPermission, validateAvailableResources, validateReservationReferences,
} from "./reservation-repository";
import { availabilityInputSchema, cancellationSchema, reservationInputSchema, reservationListSchema } from "./reservation-validation";
import { zonedDateTimeToUtc } from "./timezone";

function nextCode() { return `RES-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`; }

export async function checkResourceAvailability(context: OperationalContext, raw: unknown) {
  if (!context.permissions.has("reservations.view") && !context.permissions.has("reservations.create")) throw new AppError("FORBIDDEN", "Você não possui permissão para esta ação.");
  const input = availabilityInputSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const timeZone = await getTenantTimeZone(tx, context.tenantId);
    const startAt = zonedDateTimeToUtc(input.startAtLocal, timeZone);
    const endAt = zonedDateTimeToUtc(input.endAtLocal, timeZone);
    requireValidPeriod(startAt, endAt);
    const resourceIds = await validateAvailableResources(tx, context.tenantId, input.unitId, input.resourceIds);
    const unavailableResourceIds = await findBlockingResourceIds(tx, context.tenantId, resourceIds, startAt, endAt, input.reservationId);
    return { available: unavailableResourceIds.length === 0, unavailableResourceIds, startAt, endAt, timeZone };
  });
}

export async function createReservation(context: OperationalContext, raw: unknown) {
  requirePermission(context.permissions, "reservations.create");
  const input = reservationInputSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const timeZone = await getTenantTimeZone(tx, context.tenantId);
      const startAt = zonedDateTimeToUtc(input.startAtLocal, timeZone);
      const endAt = zonedDateTimeToUtc(input.endAtLocal, timeZone);
      requireValidPeriod(startAt, endAt);
      const resourceIds = await validateReservationReferences(tx, context, { ...input, startAt, endAt });
      if (reservationBlocksAvailability(input.status) && (await findBlockingResourceIds(tx, context.tenantId, resourceIds, startAt, endAt)).length) throw reservationConflict();
      const reservation = await tx.reservation.create({ data: { tenantId: context.tenantId, customerId: input.customerId, contractId: input.contractId, unitId: input.unitId, code: nextCode(), title: input.title, description: input.description, startAt, endAt, status: input.status, createdByUserId: context.user.id } });
      await tx.reservationItem.createMany({ data: resourceIds.map((resourceId) => ({ tenantId: context.tenantId, reservationId: reservation.id, resourceId, startAt, endAt, status: input.status })) });
      await tx.reservationStatusHistory.create({ data: { tenantId: context.tenantId, reservationId: reservation.id, fromStatus: null, toStatus: input.status, actorUserId: context.user.id } });
      await tx.auditLog.create({ data: reservationAudit(context, "reservation.created", reservation.id, { status: input.status, resourceCount: resourceIds.length }) });
      return reservation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { mapReservationError(error); }
}

export async function updateReservation(context: OperationalContext, reservationId: string, raw: unknown) {
  requirePermission(context.permissions, "reservations.update");
  const input = reservationInputSchema.omit({ status: true }).parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findFirst({ where: { id: reservationId, tenantId: context.tenantId }, select: { status: true, startAt: true, endAt: true } });
      if (!current) throw reservationNotFound();
      if (current.status === "CANCELLED") throw new AppError("CONFLICT", "Reserva cancelada não pode ser alterada.");
      const timeZone = await getTenantTimeZone(tx, context.tenantId);
      const startAt = zonedDateTimeToUtc(input.startAtLocal, timeZone);
      const endAt = zonedDateTimeToUtc(input.endAtLocal, timeZone);
      requireValidPeriod(startAt, endAt);
      const resourceIds = await validateReservationReferences(tx, context, { ...input, startAt, endAt });
      if (reservationBlocksAvailability(current.status) && (await findBlockingResourceIds(tx, context.tenantId, resourceIds, startAt, endAt, reservationId)).length) throw reservationConflict();
      await tx.reservation.updateMany({ where: { id: reservationId, tenantId: context.tenantId }, data: { customerId: input.customerId, contractId: input.contractId, unitId: input.unitId, title: input.title, description: input.description, startAt, endAt } });
      await tx.reservationItem.deleteMany({ where: { reservationId, tenantId: context.tenantId } });
      await tx.reservationItem.createMany({ data: resourceIds.map((resourceId) => ({ tenantId: context.tenantId, reservationId, resourceId, startAt, endAt, status: current.status })) });
      const periodChanged = current.startAt.valueOf() !== startAt.valueOf() || current.endAt.valueOf() !== endAt.valueOf();
      await tx.auditLog.create({ data: reservationAudit(context, periodChanged ? "reservation.period_changed" : "reservation.resources_changed", reservationId, { resourceCount: resourceIds.length }) });
      return tx.reservation.findFirstOrThrow({ where: { id: reservationId, tenantId: context.tenantId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { mapReservationError(error); }
}

export async function transitionReservation(context: OperationalContext, reservationId: string, toStatus: ReservationStatus, reason?: string) {
  requirePermission(context.permissions, transitionPermission(toStatus));
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findFirst({ where: { id: reservationId, tenantId: context.tenantId }, include: { items: { select: { resourceId: true } } } });
      if (!current) throw reservationNotFound();
      requireReservationTransition(current.status, toStatus);
      if (reservationBlocksAvailability(toStatus) && (await findBlockingResourceIds(tx, context.tenantId, current.items.map(({ resourceId }) => resourceId), current.startAt, current.endAt, current.id)).length) throw reservationConflict();
      const cancellation = toStatus === "CANCELLED" ? cancellationSchema.parse({ reason }) : undefined;
      const updated = await tx.reservation.updateMany({ where: { id: reservationId, tenantId: context.tenantId, status: current.status }, data: { status: toStatus, ...(cancellation ? { cancelledAt: new Date(), cancelledByUserId: context.user.id, cancellationReason: cancellation.reason } : {}) } });
      if (updated.count !== 1) throw reservationConflict();
      await tx.reservationItem.updateMany({ where: { reservationId, tenantId: context.tenantId }, data: { status: toStatus } });
      await tx.reservationStatusHistory.create({ data: { tenantId: context.tenantId, reservationId, fromStatus: current.status, toStatus, actorUserId: context.user.id, reason: cancellation?.reason } });
      const action = toStatus === "PENDING" ? "reservation.submitted" : toStatus === "CONFIRMED" ? "reservation.confirmed" : "reservation.cancelled";
      await tx.auditLog.create({ data: reservationAudit(context, action, reservationId, { fromStatus: current.status, toStatus }) });
      return tx.reservation.findFirstOrThrow({ where: { id: reservationId, tenantId: context.tenantId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { mapReservationError(error); }
}

export async function cancelReservation(context: OperationalContext, reservationId: string, raw: unknown) {
  const { reason } = cancellationSchema.parse(raw);
  return transitionReservation(context, reservationId, "CANCELLED", reason);
}

export async function listReservations(context: OperationalContext, raw: unknown = {}) {
  requirePermission(context.permissions, "reservations.view");
  const query = reservationListSchema.parse(raw);
  const tenant = await prisma.tenant.findUnique({ where: { id: context.tenantId }, select: { timeZone: true } });
  if (!tenant) throw reservationNotFound();
  const from = query.from ? zonedDateTimeToUtc(query.from, tenant.timeZone) : undefined;
  const to = query.to ? zonedDateTimeToUtc(query.to, tenant.timeZone) : undefined;
  const where: Prisma.ReservationWhereInput = {
    tenantId: context.tenantId,
    ...(query.status ? { status: query.status as ReservationStatus } : {}),
    ...(query.search ? { OR: [{ code: { contains: query.search, mode: "insensitive" } }, { title: { contains: query.search, mode: "insensitive" } }, { customer: { legalName: { contains: query.search, mode: "insensitive" } } }] } : {}),
    ...(from ? { endAt: { gt: from } } : {}),
    ...(to ? { startAt: { lt: to } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.reservation.findMany({ where, include: { customer: { select: { legalName: true } }, unit: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: { startAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.reservation.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getReservation(context: OperationalContext, id: string) {
  requirePermission(context.permissions, "reservations.view");
  const reservation = await prisma.reservation.findFirst({ where: { id, tenantId: context.tenantId }, include: { customer: true, contract: true, unit: true, items: { include: { resource: true } }, statusHistory: { include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!reservation) throw reservationNotFound();
  return reservation;
}

export async function getReservationFormOptions(context: OperationalContext) {
  if (!context.permissions.has("reservations.create") && !context.permissions.has("reservations.update")) throw new AppError("FORBIDDEN", "Você não possui permissão para esta ação.");
  const [customers, contracts, units, resources, tenant] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true, legalName: true }, orderBy: { legalName: "asc" }, take: 300 }),
    prisma.contract.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true, code: true, customerId: true }, orderBy: { code: "asc" }, take: 300 }),
    prisma.unit.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.resource.findMany({ where: { tenantId: context.tenantId, status: "ACTIVE", operationalStatus: "AVAILABLE" }, select: { id: true, name: true, code: true, unitId: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.tenant.findUniqueOrThrow({ where: { id: context.tenantId }, select: { timeZone: true } }),
  ]);
  return { customers, contracts, units, resources, timeZone: tenant.timeZone };
}
