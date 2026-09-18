import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";

export const pickupIntentSchema = z.object({
  operationType: z.literal("PICKUP_ATTACHMENTS"),
  clientOperationId: z.string().uuid(), deviceId: z.string().uuid(),
  tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(),
  expectedVersion: z.number().int().positive(), schemaVersion: z.literal(1),
  payload: z.object({ description: z.literal("Anexos de retirada") }),
});

export async function syncPickupIntent(context: OperationalContext, raw: unknown) {
  const input = pickupIntentSchema.parse(raw);
  if (context.tenantId !== input.tenantId || context.user.id !== input.userId) throw new AppError("FORBIDDEN", "Operação de outra conta ou empresa.");
  if (!context.permissions.has("pickups.add_evidence") && !context.permissions.has("pickups.acceptance.capture_signature")) throw new AppError("FORBIDDEN", "Sem permissão para anexos de retirada.");
  const payloadHash = createHash("sha256").update(JSON.stringify({ aggregateId: input.aggregateId, expectedVersion: input.expectedVersion, operationType: input.operationType, payload: input.payload })).digest("hex");
  const identity = { tenantId: context.tenantId, clientOperationId: input.clientOperationId };
  const existing = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: identity } });
  if (existing) {
    if (existing.userId !== context.user.id || existing.deviceId !== input.deviceId || existing.aggregateType !== "ReservationPickup" || existing.aggregateId !== input.aggregateId || existing.payloadHash !== payloadHash) throw new AppError("CONFLICT", "Identificador de operação reutilizado.");
    return { resultReference: input.aggregateId, duplicate: true };
  }
  try {
    return await prisma.$transaction(async tx => {
      const pickup = await tx.reservationPickup.findFirst({ where: { id: input.aggregateId, tenantId: context.tenantId }, select: { id: true, status: true, version: true } });
      if (!pickup) throw new AppError("NOT_FOUND", "Retirada não encontrada.");
      if (pickup.status !== "IN_PROGRESS" || pickup.version !== input.expectedVersion) throw new AppError("CONFLICT", "Retirada alterada desde a captura local.");
      await tx.clientOperation.create({ data: { tenantId: context.tenantId, userId: context.user.id, clientOperationId: input.clientOperationId, deviceId: input.deviceId, operationType: input.operationType, aggregateType: "ReservationPickup", aggregateId: pickup.id, payloadHash, resultReference: pickup.id } });
      return { resultReference: pickup.id, duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      const receipt = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: identity } });
      if (receipt && receipt.userId === context.user.id && receipt.deviceId === input.deviceId && receipt.aggregateId === input.aggregateId && receipt.payloadHash === payloadHash) return { resultReference: input.aggregateId, duplicate: true };
      throw new AppError("CONFLICT", "Retirada ou operação alterada durante a sincronização.");
    }
    throw error;
  }
}
