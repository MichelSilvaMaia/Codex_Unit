import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { completePickup } from "@/server/pickups/pickup-service";

export const pickupCompleteSchema = z.object({
  operationType: z.literal("PICKUP_COMPLETE"), clientOperationId: z.string().uuid(), deviceId: z.string().uuid(),
  tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(),
  expectedVersion: z.number().int().positive(), schemaVersion: z.literal(1),
  dependsOnOperationIds: z.array(z.string().uuid()).min(1),
  payload: z.object({ description: z.literal("Concluir retirada") }),
});
export const pickupFullAckSchema = z.object({
  clientOperationId: z.string().uuid(), pickupId: z.string().uuid(), pickupStatus: z.literal("COMPLETED"),
  completedAt: z.string().datetime(), resultReference: z.string().uuid(), processedAt: z.string().datetime(),
  resourceResults: z.array(z.object({ resourceId: z.string().uuid(), operationalStatus: z.literal("IN_USE") })).min(1),
  custodyEventIds: z.array(z.string().uuid()).min(1), custodyConfirmed: z.literal(true),
  acceptanceId: z.string().uuid(), evidenceConfirmed: z.literal(true), fullAck: z.literal(true),
});

export async function syncPickupCompletion(context: OperationalContext, raw: unknown) {
  const input = pickupCompleteSchema.parse(raw);
  if (input.tenantId !== context.tenantId || input.userId !== context.user.id) throw new AppError("FORBIDDEN", "Operação de outra conta ou empresa.");
  const dependencies = [...input.dependsOnOperationIds].sort();
  if (new Set(dependencies).size !== dependencies.length) throw new AppError("CONFLICT", "Dependências repetidas.");
  const payloadHash = createHash("sha256").update(JSON.stringify({ operationType: input.operationType, pickupId: input.aggregateId, expectedVersion: input.expectedVersion, dependencyOperationIds: dependencies })).digest("hex");
  await completePickup(context, input.aggregateId, input.expectedVersion, { clientOperationId: input.clientOperationId, deviceId: input.deviceId, payloadHash, dependencyOperationIds: dependencies });
  const receipt = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: { tenantId: context.tenantId, clientOperationId: input.clientOperationId } } });
  if (!receipt || receipt.userId !== context.user.id || receipt.deviceId !== input.deviceId || receipt.operationType !== "PICKUP_COMPLETE" || receipt.aggregateId !== input.aggregateId || receipt.payloadHash !== payloadHash || !receipt.resultPayload) throw new AppError("CONFLICT", "Confirmação transacional da retirada não encontrada.");
  const ack = pickupFullAckSchema.parse(receipt.resultPayload);
  if (ack.clientOperationId !== input.clientOperationId || ack.pickupId !== input.aggregateId || ack.resultReference !== input.aggregateId || ack.resourceResults.length !== ack.custodyEventIds.length) throw new AppError("CONFLICT", "FULL ACK inconsistente.");
  return ack;
}
