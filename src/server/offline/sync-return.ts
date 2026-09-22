import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { deriveDisposition } from "@/server/returns/return-service";

const item = z.object({ returnItemId: z.string().uuid(), presence: z.enum(["PRESENT", "NOT_PRESENT"]), condition: z.enum(["GOOD", "DAMAGED", "MISSING_COMPONENTS", "DIRTY", "UNUSABLE", "OTHER"]).optional(), disposition: z.enum(["MAINTENANCE", "UNAVAILABLE"]).optional(), notes: z.string().max(2000) });
export const returnIntentSchema = z.object({ operationType: z.literal("RETURN_ATTACHMENTS"), clientOperationId: z.string().uuid(), deviceId: z.string().uuid(), tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(), expectedVersion: z.number().int().positive(), schemaVersion: z.literal(1), dependsOnOperationIds: z.array(z.string().uuid()), payload: z.object({ description: z.string(), returnInspection: z.object({ items: z.array(item).min(1), savedAt: z.string().datetime() }) }) });

export async function syncReturnIntent(context: OperationalContext, raw: unknown) {
  const input = returnIntentSchema.parse(raw);
  if (input.tenantId !== context.tenantId || input.userId !== context.user.id) throw new AppError("FORBIDDEN", "Operação de outra conta ou empresa.");
  requirePermission(context.permissions, "returns.inspect");
  const payloadHash = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
  const identity = { tenantId: context.tenantId, clientOperationId: input.clientOperationId };
  const prior = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: identity } });
  if (prior) {
    if (prior.userId !== context.user.id || prior.deviceId !== input.deviceId || prior.operationType !== input.operationType || prior.aggregateId !== input.aggregateId || prior.payloadHash !== payloadHash) throw new AppError("CONFLICT", "Identificador reutilizado com outra operação.");
    return { resultReference: prior.resultReference, serverVersion: prior.resultVersion };
  }
  try { return await prisma.$transaction(async tx => {
    const record = await tx.reservationReturn.findFirst({ where: { id: input.aggregateId, tenantId: context.tenantId, status: "IN_PROGRESS" }, include: { items: true } });
    if (!record || record.version !== input.expectedVersion || record.items.length !== input.payload.returnInspection.items.length) throw new AppError("CONFLICT", "Devolução alterada desde o snapshot.");
    const expected = new Set(record.items.map(row => row.id));
    if (new Set(input.payload.returnInspection.items.map(row => row.returnItemId)).size !== expected.size || input.payload.returnInspection.items.some(row => !expected.has(row.returnItemId) || row.presence === "PRESENT" && (!row.condition || row.condition !== "GOOD" && row.notes.trim().length < 3))) throw new AppError("VALIDATION_ERROR", "Inspeção integral inválida.");
    const changed = await tx.reservationReturn.updateMany({ where: { id: record.id, tenantId: context.tenantId, status: "IN_PROGRESS", version: record.version }, data: { version: { increment: 1 } } });
    if (changed.count !== 1) throw new AppError("CONFLICT", "Devolução alterada concorrentemente.");
    for (const row of input.payload.returnInspection.items) await tx.reservationReturnItem.update({ where: { id: row.returnItemId }, data: { presence: row.presence, condition: row.presence === "PRESENT" ? row.condition : null, disposition: row.presence === "PRESENT" ? deriveDisposition(row.condition!, row.disposition) : null, notes: row.notes || null, inspectedAt: new Date(), inspectedByUserId: context.user.id } });
    await tx.auditLog.create({ data: { scope: "TENANT", tenantId: context.tenantId, actorUserId: context.user.id, action: "offline.return_inspection.confirmed", entityType: "ReservationReturn", entityId: record.id, metadata: { clientOperationId: input.clientOperationId, itemCount: record.items.length } } });
    await tx.clientOperation.create({ data: { ...identity, userId: context.user.id, deviceId: input.deviceId, operationType: input.operationType, aggregateType: "ReservationReturn", aggregateId: record.id, payloadHash, resultReference: record.id, resultVersion: record.version + 1 } });
    return { resultReference: record.id, serverVersion: record.version + 1 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new AppError("CONFLICT", "Devolução alterada concorrentemente."); throw error; }
}
