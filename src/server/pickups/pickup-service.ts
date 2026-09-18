import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { requirePickupEligibility } from "./pickup-policy";
import { inspectionSchema, pickupListSchema, refusalSchema, startPickupSchema } from "./pickup-validation";

const notFound = () => new AppError("NOT_FOUND", "Retirada ou reserva não encontrada.");
const conflict = () => new AppError("CONFLICT", "A retirada foi alterada por outra operação ou já foi concluída.");
function mapError(error: unknown): never { if (error instanceof AppError) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw conflict(); if (error instanceof Error && /deadlock|40P01|unique|concurrent/i.test(error.message)) throw conflict(); throw error; }
const audit = (context: OperationalContext, action: string, id: string, metadata?: Prisma.InputJsonValue) => ({ scope: "TENANT" as const, tenantId: context.tenantId, actorUserId: context.user.id, action, entityType: "ReservationPickup", entityId: id, metadata });

export async function startPickup(context: OperationalContext, reservationId: string, raw: unknown) {
  requirePermission(context.permissions, "pickups.start"); const input = startPickupSchema.parse(raw);
  try { return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findFirst({ where: { id: reservationId, tenantId: context.tenantId }, include: { items: true, pickups: { where: { status: { in: ["IN_PROGRESS", "COMPLETED"] } }, select: { id: true } } } });
    if (!reservation) throw notFound(); requirePickupEligibility(reservation.status, reservation.startAt); if (reservation.pickups.length) throw conflict();
    if (reservation.status === "CONFIRMED") { const changed = await tx.reservation.updateMany({ where: { id: reservation.id, tenantId: context.tenantId, status: "CONFIRMED" }, data: { status: "READY_FOR_PICKUP" } }); if (changed.count !== 1) throw conflict(); await tx.reservationItem.updateMany({ where: { reservationId: reservation.id, tenantId: context.tenantId }, data: { status: "READY_FOR_PICKUP" } }); await tx.reservationStatusHistory.create({ data: { tenantId: context.tenantId, reservationId, fromStatus: "CONFIRMED", toStatus: "READY_FOR_PICKUP", actorUserId: context.user.id } }); }
    const pickup = await tx.reservationPickup.create({ data: { tenantId: context.tenantId, reservationId, processedByUserId: context.user.id, ...input } });
    await tx.reservationPickupItem.createMany({ data: reservation.items.map((item) => ({ tenantId: context.tenantId, pickupId: pickup.id, reservationItemId: item.id, resourceId: item.resourceId })) });
    await tx.auditLog.create({ data: audit(context, "pickup.started", pickup.id, { reservationId, itemCount: reservation.items.length }) }); return pickup;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (e) { mapError(e); }
}

export async function inspectPickup(context: OperationalContext, pickupId: string, raw: unknown, expectedVersion?: number) {
  requirePermission(context.permissions, "pickups.inspect"); const input = inspectionSchema.parse(raw);
  return prisma.$transaction(async (tx) => { const pickup = await tx.reservationPickup.findFirst({ where: { id: pickupId, tenantId: context.tenantId, status: "IN_PROGRESS" }, include: { items: true } }); if (!pickup) throw notFound(); if (expectedVersion !== undefined && pickup.version !== expectedVersion) throw conflict(); const expected = new Set(pickup.items.map(({ id }) => id)); if (input.items.length !== expected.size || input.items.some(({ pickupItemId }) => !expected.has(pickupItemId))) throw new AppError("VALIDATION_ERROR", "A conferência deve incluir exatamente todos os recursos esperados."); const claimed = await tx.reservationPickup.updateMany({ where: { id: pickupId, tenantId: context.tenantId, status: "IN_PROGRESS", version: pickup.version }, data: { version: { increment: 1 } } }); if (claimed.count !== 1) throw conflict(); for (const item of input.items) await tx.reservationPickupItem.update({ where: { id: item.pickupItemId }, data: { condition: item.condition, notes: item.notes, checkedAt: new Date(), checkedByUserId: context.user.id } }); await tx.auditLog.create({ data: audit(context, "pickup.item_checked", pickupId, { itemCount: input.items.length }) }); });
}

export async function refusePickup(context: OperationalContext, pickupId: string, raw: unknown) {
  requirePermission(context.permissions, "pickups.refuse"); const input = refusalSchema.parse(raw);
  return prisma.$transaction(async (tx) => { const changed = await tx.reservationPickup.updateMany({ where: { id: pickupId, tenantId: context.tenantId, status: "IN_PROGRESS" }, data: { status: "REFUSED", version: { increment: 1 }, refusedAt: new Date(), refusalReasonCode: input.reasonCode, refusalNotes: input.notes } }); if (changed.count !== 1) throw conflict(); await tx.reservationPickupItem.updateMany({ where: { pickupId, tenantId: context.tenantId }, data: { status: "REFUSED" } }); await tx.pickupOtpChallenge.updateMany({where:{tenantId:context.tenantId,acceptance:{pickupId},status:"PENDING"},data:{status:"INVALIDATED",invalidatedAt:new Date()}}); await tx.pickupAcceptance.updateMany({where:{tenantId:context.tenantId,pickupId,status:"PENDING"},data:{status:"CANCELLED"}}); await tx.auditLog.create({ data: audit(context, "pickup.refused", pickupId, input) }); });
}

export type OfflinePickupCompletion = { clientOperationId: string; deviceId: string; payloadHash: string; dependencyOperationIds: string[] };

function matchesCompletionReceipt(receipt: { userId: string; deviceId: string; operationType: string; aggregateType: string; aggregateId: string; payloadHash: string }, context: OperationalContext, pickupId: string, offline: OfflinePickupCompletion) {
  return receipt.userId === context.user.id && receipt.deviceId === offline.deviceId && receipt.operationType === "PICKUP_COMPLETE" && receipt.aggregateType === "ReservationPickup" && receipt.aggregateId === pickupId && receipt.payloadHash === offline.payloadHash;
}

export async function completePickup(context: OperationalContext, pickupId: string, expectedVersion?: number, offline?: OfflinePickupCompletion) {
  requirePermission(context.permissions, "pickups.complete");
  if (offline && (!Number.isSafeInteger(expectedVersion) || !offline.dependencyOperationIds.length || new Set(offline.dependencyOperationIds).size !== offline.dependencyOperationIds.length)) throw conflict();
  const identity = offline ? { tenantId: context.tenantId, clientOperationId: offline.clientOperationId } : null;
  async function priorResult() {
    if (!identity || !offline) return null;
    const receipt = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: identity } });
    if (!receipt) return null;
    if (!matchesCompletionReceipt(receipt, context, pickupId, offline)) throw conflict();
    return prisma.reservationPickup.findFirst({ where: { id: pickupId, tenantId: context.tenantId, status: "COMPLETED" } });
  }
  const prior = await priorResult();
  if (prior) return prior;
  try {
    return await prisma.$transaction(async tx => {
      const pickup = await tx.reservationPickup.findFirst({ where: { id: pickupId, tenantId: context.tenantId }, include: { reservation: true, items: true } });
      if (!pickup) throw notFound();
      if (expectedVersion !== undefined && pickup.version !== expectedVersion) throw conflict();
      if (pickup.status !== "IN_PROGRESS" || pickup.reservation.status !== "READY_FOR_PICKUP" || !pickup.items.length || pickup.items.some(item => !item.checkedAt || item.condition !== "OK")) throw conflict();
      const acceptance = await tx.pickupAcceptance.findFirst({ where: { tenantId: context.tenantId, pickupId, status: "VERIFIED", acceptedAt: { not: null } }, include: { signature: true } });
      if (!acceptance) throw conflict();
      if (offline) {
        if (!acceptance.signature) throw conflict();
        const dependencies = await tx.clientOperation.findMany({ where: { tenantId: context.tenantId, clientOperationId: { in: offline.dependencyOperationIds } } });
        if (dependencies.length !== offline.dependencyOperationIds.length || dependencies.some(row => row.userId !== context.user.id || row.deviceId !== offline.deviceId || row.aggregateType !== "ReservationPickup" || row.aggregateId !== pickupId || row.operationType !== "PICKUP_ATTACHMENTS")) throw conflict();
        const signatureReceipt = await tx.offlineSignatureReceipt.findFirst({ where: { tenantId: context.tenantId, pickupId, acceptanceId: acceptance.id, status: "CONFIRMED", clientOperationId: { in: offline.dependencyOperationIds } } });
        if (!signatureReceipt) throw conflict();
        const evidenceReceipts = await tx.offlineAttachmentReceipt.findMany({ where: { tenantId: context.tenantId, aggregateId: pickupId, purpose: "PICKUP_EVIDENCE", clientOperationId: { in: offline.dependencyOperationIds } } });
        if (evidenceReceipts.some(row => row.status !== "CONFIRMED" || !row.evidenceId)) throw conflict();
        const ids = evidenceReceipts.map(row => row.evidenceId!).filter(Boolean);
        if (ids.length !== await tx.operationalEvidence.count({ where: { tenantId: context.tenantId, pickupId, id: { in: ids } } })) throw conflict();
      }
      const resourceIds = pickup.items.map(item => item.resourceId);
      if (new Set(resourceIds).size !== resourceIds.length) throw conflict();
      const available = await tx.resource.count({ where: { tenantId: context.tenantId, id: { in: resourceIds }, operationalStatus: "AVAILABLE" } });
      if (available !== resourceIds.length) throw conflict();
      const changed = await tx.reservationPickup.updateMany({ where: { id: pickupId, tenantId: context.tenantId, status: "IN_PROGRESS", version: pickup.version }, data: { status: "COMPLETED", completedAt: new Date(), version: { increment: 1 } } });
      if (changed.count !== 1) throw conflict();
      const reservationChanged = await tx.reservation.updateMany({ where: { id: pickup.reservationId, tenantId: context.tenantId, status: "READY_FOR_PICKUP" }, data: { status: "RELEASED" } });
      if (reservationChanged.count !== 1) throw conflict();
      await tx.reservationPickupItem.updateMany({ where: { pickupId, tenantId: context.tenantId }, data: { status: "RELEASED" } });
      await tx.reservationItem.updateMany({ where: { reservationId: pickup.reservationId, tenantId: context.tenantId }, data: { status: "RELEASED" } });
      await tx.reservationStatusHistory.create({ data: { tenantId: context.tenantId, reservationId: pickup.reservationId, fromStatus: "READY_FOR_PICKUP", toStatus: "RELEASED", actorUserId: context.user.id } });
      const resourcesChanged = await tx.resource.updateMany({ where: { id: { in: resourceIds }, tenantId: context.tenantId, operationalStatus: "AVAILABLE" }, data: { operationalStatus: "IN_USE" } });
      if (resourcesChanged.count !== resourceIds.length) throw conflict();
      await tx.resourceCustodyEvent.createMany({ data: pickup.items.map(item => ({ tenantId: context.tenantId, resourceId: item.resourceId, reservationId: pickup.reservationId, pickupId, type: "RELEASED_TO_RECIPIENT", fromParty: pickup.reservation.unitId, toParty: pickup.recipientName, actorUserId: context.user.id })) });
      await tx.auditLog.create({ data: audit(context, "pickup.completed", pickupId, { recipientName: pickup.recipientName, itemCount: pickup.items.length, clientOperationId: offline?.clientOperationId }) });
      const completed = await tx.reservationPickup.findUniqueOrThrow({ where: { id: pickupId } });
      if (offline) {
        const events = await tx.resourceCustodyEvent.findMany({ where: { tenantId: context.tenantId, pickupId, type: "RELEASED_TO_RECIPIENT" }, select: { id: true, resourceId: true } });
        if (events.length !== resourceIds.length) throw conflict();
        const processedAt = new Date();
        const resultPayload = { clientOperationId: offline.clientOperationId, pickupId, pickupStatus: "COMPLETED", completedAt: completed.completedAt!.toISOString(), resultReference: pickupId, processedAt: processedAt.toISOString(), resourceResults: resourceIds.map(resourceId => ({ resourceId, operationalStatus: "IN_USE" })), custodyEventIds: events.map(event => event.id), custodyConfirmed: true, acceptanceId: acceptance.id, evidenceConfirmed: true, fullAck: true };
        await tx.clientOperation.create({ data: { tenantId: context.tenantId, userId: context.user.id, clientOperationId: offline.clientOperationId, deviceId: offline.deviceId, operationType: "PICKUP_COMPLETE", aggregateType: "ReservationPickup", aggregateId: pickupId, payloadHash: offline.payloadHash, resultReference: pickupId, resultVersion: pickup.version + 1, processedAt, resultPayload } });
      }
      return completed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (offline && error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      const prior = await priorResult();
      if (prior) return prior;
    }
    mapError(error);
  }
}

export async function listPickupQueue(context: OperationalContext, raw: unknown = {}) { requirePermission(context.permissions, "pickups.view"); const q = pickupListSchema.parse(raw); return prisma.reservation.findMany({ where: { tenantId: context.tenantId, status: { in: ["CONFIRMED", "READY_FOR_PICKUP", "RELEASED"] }, ...(q.urgent ? { isUrgent: q.urgent === "true" } : {}), ...(q.search ? { OR: [{ code: { contains: q.search, mode: "insensitive" } }, { customer: { legalName: { contains: q.search, mode: "insensitive" } } }] } : {}), ...(q.status === "completed" ? { pickups: { some: { status: "COMPLETED" } } } : q.status === "refused" ? { pickups: { some: { status: "REFUSED" } } } : {}) }, include: { customer: true, unit: true, pickups: { orderBy: { createdAt: "desc" } }, _count: { select: { items: true } } }, orderBy: [{ isUrgent: "desc" }, { startAt: "asc" }] }); }
export async function getPickup(context: OperationalContext, id: string) { requirePermission(context.permissions, "pickups.view"); const result = await prisma.reservationPickup.findFirst({ where: { id, tenantId: context.tenantId }, include: { reservation: { include: { customer: true, unit: true } }, processedBy: { select: { name: true, email: true } }, items: { include: { resource: true } }, evidence: true, custodyEvents: true, acceptances: { include: { challenges: true, signature: true }, orderBy: { createdAt: "desc" } } } }); if (!result) throw notFound(); return result; }
