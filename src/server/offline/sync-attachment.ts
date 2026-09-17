import { createHash } from "node:crypto";
import { MaintenanceEvidenceType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { validateEvidence } from "@/server/pickups/evidence-service";
import { localStorageProvider } from "@/server/storage/local-storage-provider";
import type { StorageProvider } from "@/server/storage/storage-provider";

const inputSchema = z.object({
  attachmentId: z.string().uuid(), clientOperationId: z.string().uuid(), deviceId: z.string().uuid(),
  tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(),
  type: z.nativeEnum(MaintenanceEvidenceType), checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
const expired = () => new Date(Date.now() - 120_000);
export class AttachmentBusyError extends Error {}
const busy = () => new AttachmentBusyError("Upload em andamento. Tente novamente após a recuperação.");

/** The receipt claim is committed before storage I/O; no PostgreSQL transaction spans the upload. */
export async function syncMaintenanceAttachment(context: OperationalContext, raw: unknown, content: Uint8Array, mimeType: string, storage: StorageProvider = localStorageProvider) {
  const input = inputSchema.parse(raw);
  if (context.tenantId !== input.tenantId || context.user.id !== input.userId) throw new AppError("FORBIDDEN", "Evidência de outra conta ou empresa.");
  requirePermission(context.permissions, "maintenance.add_evidence");
  validateEvidence(content, mimeType);
  const checksum = createHash("sha256").update(content).digest("hex");
  if (checksum !== input.checksum) throw new AppError("CONFLICT", "Checksum da evidência diverge do conteúdo.");
  const operation = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: { tenantId: context.tenantId, clientOperationId: input.clientOperationId } } });
  if (!operation || operation.userId !== context.user.id || operation.deviceId !== input.deviceId || operation.aggregateType !== "MaintenanceOrder" || operation.aggregateId !== input.aggregateId) throw new AppError("FORBIDDEN", "Operação original não confirmada para esta evidência.");
  const order = await prisma.maintenanceOrder.findFirst({ where: { id: input.aggregateId, tenantId: context.tenantId }, select: { id: true, status: true } });
  if (!order) throw new AppError("NOT_FOUND", "Ordem de manutenção não encontrada.");
  const orderId = order.id;
  const key = `${context.tenantId}/maintenance/${orderId}/offline-${input.attachmentId}`;
  const identity = { tenantId: context.tenantId, attachmentId: input.attachmentId };
  let receipt = await prisma.offlineAttachmentReceipt.findUnique({ where: { tenantId_attachmentId: identity } });
  function same(r: NonNullable<typeof receipt>) {
    if (r.userId !== context.user.id || r.deviceId !== input.deviceId || r.clientOperationId !== input.clientOperationId || r.aggregateId !== orderId || r.checksum !== checksum || r.mimeType !== mimeType || r.size !== content.byteLength || r.evidenceType !== input.type) throw new AppError("CONFLICT", "Identificador da evidência reutilizado com conteúdo ou propriedade diferente.");
  }
  if (receipt) {
    same(receipt);
    if (receipt.status === "CONFIRMED" && receipt.evidenceId) return { attachmentId: input.attachmentId, evidenceId: receipt.evidenceId, checksum, status: "SERVER_CONFIRMED" as const, duplicate: true };
    if (["CANCELLED", "RELEASED"].includes(order.status)) throw new AppError("CONFLICT", "Ordem não aceita novas evidências.");
    if (receipt.claimedAt > expired()) throw busy();
    const claimTime = new Date();
    const claimed = await prisma.offlineAttachmentReceipt.updateMany({ where: { id: receipt.id, status: "CLAIMED", claimedAt: { lte: expired() } }, data: { claimedAt: claimTime } });
    if (claimed.count !== 1) throw busy();
    receipt = { ...receipt, claimedAt: claimTime };
  } else {
    if (["CANCELLED", "RELEASED"].includes(order.status)) throw new AppError("CONFLICT", "Ordem não aceita novas evidências.");
    try {
      receipt = await prisma.offlineAttachmentReceipt.create({ data: { ...identity, userId: context.user.id, deviceId: input.deviceId, clientOperationId: input.clientOperationId, aggregateId: order.id, checksum, mimeType, size: content.byteLength, evidenceType: input.type, status: "CLAIMED", storageKey: key } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const current = await prisma.offlineAttachmentReceipt.findUnique({ where: { tenantId_attachmentId: identity } });
        if (current) { same(current); if (current.status === "CONFIRMED" && current.evidenceId) return { attachmentId: input.attachmentId, evidenceId: current.evidenceId, checksum, status: "SERVER_CONFIRMED" as const, duplicate: true }; }
        throw busy();
      }
      throw error;
    }
  }
  try {
    await storage.put(key, content, mimeType);
    const evidence = await prisma.$transaction(async tx => {
      const created = await tx.maintenanceEvidence.create({ data: { tenantId: context.tenantId, maintenanceOrderId: order.id, type: input.type, storageKey: key, mimeType, size: content.byteLength, checksum, uploadedByUserId: context.user.id } });
      const changed = await tx.offlineAttachmentReceipt.updateMany({ where: { id: receipt!.id, status: "CLAIMED", claimedAt: receipt!.claimedAt }, data: { status: "CONFIRMED", evidenceId: created.id, confirmedAt: new Date() } });
      if (changed.count !== 1) throw busy();
      await tx.auditLog.create({ data: { scope: "TENANT", tenantId: context.tenantId, actorUserId: context.user.id, action: "offline.attachment.confirmed", entityType: "MaintenanceOrder", entityId: order.id, metadata: { attachmentId: input.attachmentId, clientOperationId: input.clientOperationId, evidenceId: created.id } } });
      return created;
    });
    return { attachmentId: input.attachmentId, evidenceId: evidence.id, checksum, status: "SERVER_CONFIRMED" as const, duplicate: false };
  } catch (error) {
    // Do not delete a newer claim's object if a stale upload lost its lease.
    const owned = await prisma.offlineAttachmentReceipt.findFirst({ where: { id: receipt!.id, status: "CLAIMED", claimedAt: receipt!.claimedAt }, select: { id: true } });
    if (owned) {
      await storage.delete(key).catch(() => undefined);
      await prisma.offlineAttachmentReceipt.updateMany({ where: { id: receipt!.id, status: "CLAIMED", claimedAt: receipt!.claimedAt }, data: { claimedAt: new Date(0) } });
    }
    throw error;
  }
}
