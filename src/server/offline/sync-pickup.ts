import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { inspectionSchema } from "@/server/pickups/pickup-validation";

const pickupInspection = z.object({
  recipientName: z.string().trim().min(2).max(160), recipientDocument: z.string().max(40),
  recipientPhone: z.string().max(40), vehiclePlate: z.string().max(12), notes: z.string().max(1000),
  items: inspectionSchema.shape.items, savedAt: z.string().datetime(),
});

export const pickupIntentSchema = z.object({
  operationType: z.literal("PICKUP_ATTACHMENTS"),
  clientOperationId: z.string().uuid(), deviceId: z.string().uuid(),
  tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(),
  expectedVersion: z.number().int().positive(), schemaVersion: z.literal(1),
  payload: z.object({ description: z.literal("Anexos de retirada"), inspection: pickupInspection.optional() }),
});

export async function syncPickupIntent(context: OperationalContext, raw: unknown) {
  const input = pickupIntentSchema.parse(raw);
  if (context.tenantId !== input.tenantId || context.user.id !== input.userId) throw new AppError("FORBIDDEN", "Operação de outra conta ou empresa.");
  if (!context.permissions.has("pickups.add_evidence") && !context.permissions.has("pickups.acceptance.capture_signature")) throw new AppError("FORBIDDEN", "Sem permissão para anexos de retirada.");
  if (input.payload.inspection && !context.permissions.has("pickups.inspect")) throw new AppError("FORBIDDEN", "Sem permissão para inspeção da retirada.");
  const payloadHash = createHash("sha256").update(JSON.stringify({ aggregateId: input.aggregateId, expectedVersion: input.expectedVersion, operationType: input.operationType, payload: input.payload })).digest("hex");
  const identity = { tenantId: context.tenantId, clientOperationId: input.clientOperationId };
  const existing = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: identity } });
  if (existing) {
    if (existing.userId !== context.user.id || existing.deviceId !== input.deviceId || existing.aggregateType !== "ReservationPickup" || existing.aggregateId !== input.aggregateId || existing.payloadHash !== payloadHash) throw new AppError("CONFLICT", "Identificador de operação reutilizado.");
    return { resultReference: input.aggregateId, serverVersion: existing.resultVersion ?? input.expectedVersion + Number(Boolean(input.payload.inspection)), duplicate: true };
  }
  try {
    return await prisma.$transaction(async tx => {
      const pickup = await tx.reservationPickup.findFirst({ where: { id: input.aggregateId, tenantId: context.tenantId }, include: { items: { select: { id: true } } } });
      if (!pickup) throw new AppError("NOT_FOUND", "Retirada não encontrada.");
      if (pickup.status !== "IN_PROGRESS" || pickup.version !== input.expectedVersion) throw new AppError("CONFLICT", "Retirada alterada desde a captura local.");
      if (input.payload.inspection) {
        const inspection = input.payload.inspection, itemIds = new Set(pickup.items.map(item => item.id));
        if (inspection.items.length !== itemIds.size || inspection.items.some(item => !itemIds.has(item.pickupItemId))) throw new AppError("CONFLICT", "Itens da inspeção não correspondem à retirada.");
        const changed = await tx.reservationPickup.updateMany({ where: { id: pickup.id, tenantId: context.tenantId, status: "IN_PROGRESS", version: input.expectedVersion }, data: { version: { increment: 1 }, recipientName: inspection.recipientName, recipientDocument: inspection.recipientDocument || null, recipientPhone: inspection.recipientPhone || null, vehiclePlate: inspection.vehiclePlate || null, notes: inspection.notes || null } });
        if (changed.count !== 1) throw new AppError("CONFLICT", "Inspeção alterada durante a sincronização.");
        for (const item of inspection.items) await tx.reservationPickupItem.update({ where: { id: item.pickupItemId }, data: { condition: item.condition, notes: item.notes || null, checkedAt: new Date(), checkedByUserId: context.user.id } });
        await tx.auditLog.create({ data: { scope: "TENANT", tenantId: context.tenantId, actorUserId: context.user.id, action: "offline.pickup_inspected", entityType: "ReservationPickup", entityId: pickup.id, metadata: { clientOperationId: input.clientOperationId, itemCount: inspection.items.length } } });
      }
      await tx.clientOperation.create({ data: { tenantId: context.tenantId, userId: context.user.id, clientOperationId: input.clientOperationId, deviceId: input.deviceId, operationType: input.operationType, aggregateType: "ReservationPickup", aggregateId: pickup.id, payloadHash, resultReference: pickup.id, resultVersion: input.expectedVersion + Number(Boolean(input.payload.inspection)) } });
      return { resultReference: pickup.id, serverVersion: input.expectedVersion + Number(Boolean(input.payload.inspection)), duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      const receipt = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: identity } });
      if (receipt && receipt.userId === context.user.id && receipt.deviceId === input.deviceId && receipt.aggregateId === input.aggregateId && receipt.payloadHash === payloadHash) return { resultReference: input.aggregateId, serverVersion: receipt.resultVersion ?? input.expectedVersion + Number(Boolean(input.payload.inspection)), duplicate: true };
      throw new AppError("CONFLICT", "Retirada ou operação alterada durante a sincronização.");
    }
    throw error;
  }
}
