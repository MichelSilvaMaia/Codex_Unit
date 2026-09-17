import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { AppError } from "@/server/errors/app-error";
import { ACTIVE_MAINTENANCE_STATUSES } from "@/server/maintenance/maintenance-state-machine";
import { activitySchema, descriptionSchema } from "@/server/maintenance/maintenance-validation";
import type { OperationalContext } from "@/server/operational/service-helpers";

export const syncMaintenanceSchema = z.discriminatedUnion("operationType", [
  z.object({ operationType: z.literal("MAINTENANCE_ADD_DIAGNOSIS"), clientOperationId: z.string().uuid(), deviceId: z.string().uuid(), tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(), expectedVersion: z.number().int().positive(), schemaVersion: z.literal(1), payload: descriptionSchema }),
  z.object({ operationType: z.literal("MAINTENANCE_ADD_ACTIVITY"), clientOperationId: z.string().uuid(), deviceId: z.string().uuid(), tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(), expectedVersion: z.number().int().positive(), schemaVersion: z.literal(1), payload: activitySchema }),
  z.object({ operationType: z.literal("MAINTENANCE_ADD_EVIDENCE"), clientOperationId: z.string().uuid(), deviceId: z.string().uuid(), tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(), expectedVersion: z.number().int().positive(), schemaVersion: z.literal(1), payload: z.object({ description: z.literal("Evidência de manutenção") }) }),
]);
export type SyncMaintenanceInput = z.infer<typeof syncMaintenanceSchema>;

function digest(input: SyncMaintenanceInput) {
  return createHash("sha256").update(JSON.stringify({ operationType: input.operationType, aggregateId: input.aggregateId, expectedVersion: input.expectedVersion, payload: input.payload })).digest("hex");
}

export async function syncMaintenanceMutation(context: OperationalContext, raw: unknown) {
  const input = syncMaintenanceSchema.parse(raw);
  if (input.tenantId !== context.tenantId || input.userId !== context.user.id) throw new AppError("FORBIDDEN", "A operação pertence a outra conta ou empresa.");
  requirePermission(context.permissions, input.operationType === "MAINTENANCE_ADD_ACTIVITY" ? "maintenance.perform" : input.operationType === "MAINTENANCE_ADD_EVIDENCE" ? "maintenance.add_evidence" : "maintenance.diagnose");
  const payloadHash = digest(input);
  const existing = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: { tenantId: context.tenantId, clientOperationId: input.clientOperationId } } });
  if (existing) {
    if (existing.userId !== context.user.id || existing.payloadHash !== payloadHash || existing.deviceId !== input.deviceId) throw new AppError("CONFLICT", "Identificador de operação reutilizado com dados diferentes.");
    return { resultReference: existing.resultReference, duplicate: true, serverVersion: (await prisma.maintenanceOrder.findFirst({ where: { id: input.aggregateId, tenantId: context.tenantId }, select: { version: true } }))?.version };
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.maintenanceOrder.findFirst({ where: { id: input.aggregateId, tenantId: context.tenantId }, select: { id: true, status: true, version: true } });
      if (!order) throw new AppError("NOT_FOUND", "Ordem não encontrada.");
      if (!ACTIVE_MAINTENANCE_STATUSES.includes(order.status) || order.version !== input.expectedVersion) throw new AppError("CONFLICT", "O registro foi alterado no servidor enquanto este dispositivo estava offline.");
      // Evidence intent does not mutate the order; it only authorizes later attachment upload.
      if (input.operationType !== "MAINTENANCE_ADD_EVIDENCE") {
        const changed = await tx.maintenanceOrder.updateMany({ where: { id: order.id, tenantId: context.tenantId, version: input.expectedVersion, status: { in: ACTIVE_MAINTENANCE_STATUSES } }, data: { updatedAt: new Date() } });
        if (changed.count !== 1) throw new AppError("CONFLICT", "O registro foi alterado no servidor enquanto este dispositivo estava offline.");
      }
      const result = input.operationType === "MAINTENANCE_ADD_ACTIVITY"
        ? await tx.maintenanceActivity.create({ data: { tenantId: context.tenantId, maintenanceOrderId: order.id, performedByUserId: context.user.id, ...input.payload } })
        : input.operationType === "MAINTENANCE_ADD_DIAGNOSIS" ? await tx.maintenanceDiagnosis.create({ data: { tenantId: context.tenantId, maintenanceOrderId: order.id, diagnosedByUserId: context.user.id, description: input.payload.description } }) : null;
      await tx.clientOperation.create({ data: { tenantId: context.tenantId, userId: context.user.id, clientOperationId: input.clientOperationId, deviceId: input.deviceId, operationType: input.operationType, aggregateType: "MaintenanceOrder", aggregateId: order.id, payloadHash, resultReference: result?.id } });
      await tx.auditLog.create({ data: { scope: "TENANT", tenantId: context.tenantId, actorUserId: context.user.id, action: "sync.processed", entityType: "MaintenanceOrder", entityId: order.id, metadata: { clientOperationId: input.clientOperationId, deviceId: input.deviceId, operationType: input.operationType } } });
      const updated = await tx.maintenanceOrder.findUniqueOrThrow({ where: { id: order.id }, select: { version: true } });
      return { resultReference: result?.id, duplicate: false, serverVersion: updated.version };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      const receipt = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: { tenantId: context.tenantId, clientOperationId: input.clientOperationId } } });
      if (receipt && receipt.userId === context.user.id && receipt.deviceId === input.deviceId && receipt.payloadHash === payloadHash) return { resultReference: receipt.resultReference, duplicate: true };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new AppError("CONFLICT", "O registro foi alterado no servidor enquanto este dispositivo estava offline.");
    throw error;
  }
}
