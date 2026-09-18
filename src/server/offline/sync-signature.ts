import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createVerifiedDrawnAcceptance } from "@/server/acceptance/acceptance-service";
import { buildPickupTerms } from "@/server/acceptance/acceptance-terms";
import { requirePermission } from "@/server/authorization/permissions";
import { AppError } from "@/server/errors/app-error";
import type { OperationalContext } from "@/server/operational/service-helpers";
import { localStorageProvider } from "@/server/storage/local-storage-provider";
import type { StorageProvider } from "@/server/storage/storage-provider";
import { AttachmentBusyError } from "./sync-attachment";
import { validateDrawnPng } from "./signature-png";

const signatureSchema = z.object({
  purpose: z.literal("PICKUP_SIGNATURE"), attachmentId: z.string().uuid(), clientOperationId: z.string().uuid(), deviceId: z.string().uuid(),
  tenantId: z.string().uuid(), userId: z.string().uuid(), aggregateId: z.string().uuid(), expectedVersion: z.number().int().positive(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/), mimeType: z.literal("image/png"), size: z.number().int().min(65).max(2_000_000),
  width: z.number().int().min(100).max(4096), height: z.number().int().min(50).max(4096),
  termsVersion: z.string().min(1), termsHash: z.string().regex(/^[a-f0-9]{64}$/), capturedAtDevice: z.string().datetime(),
});

export async function syncOfflineSignature(context: OperationalContext, raw: unknown, content: Uint8Array, mimeType: string, storage: StorageProvider = localStorageProvider) {
  const input = signatureSchema.parse(raw);
  if (context.tenantId !== input.tenantId || context.user.id !== input.userId) throw new AppError("FORBIDDEN", "Assinatura de outra conta ou empresa.");
  requirePermission(context.permissions, "pickups.acceptance.capture_signature");
  if (mimeType !== "image/png" || content.byteLength !== input.size || content.byteLength > 2_000_000 || ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => content[i] === b)) throw new AppError("VALIDATION_ERROR", "Assinatura PNG inválida.");
  validateDrawnPng(content, input.width, input.height);
  const checksum = createHash("sha256").update(content).digest("hex");
  if (checksum !== input.checksum) throw new AppError("CONFLICT", "Checksum da assinatura diverge do conteúdo.");
  const operation = await prisma.clientOperation.findUnique({ where: { tenantId_clientOperationId: { tenantId: context.tenantId, clientOperationId: input.clientOperationId } } });
  if (!operation || operation.userId !== context.user.id || operation.deviceId !== input.deviceId || operation.aggregateType !== "ReservationPickup" || operation.aggregateId !== input.aggregateId || operation.operationType !== "PICKUP_ATTACHMENTS") throw new AppError("FORBIDDEN", "Operação original não confirmada.");
  const identity = { tenantId: context.tenantId, clientOperationId: input.clientOperationId };
  let receipt = await prisma.offlineSignatureReceipt.findUnique({ where: { tenantId_clientOperationId: identity } });
  const same = (r: NonNullable<typeof receipt>) => {
    if (r.userId !== context.user.id || r.attachmentId !== input.attachmentId || r.clientOperationId !== input.clientOperationId || r.deviceId !== input.deviceId || r.pickupId !== input.aggregateId || r.expectedVersion !== input.expectedVersion || r.checksum !== checksum || r.size !== input.size || r.width !== input.width || r.height !== input.height || r.termsVersion !== input.termsVersion || r.termsHash !== input.termsHash || r.capturedAtDevice.toISOString() !== input.capturedAtDevice) throw new AppError("CONFLICT", "Identificador de assinatura reutilizado com dados diferentes.");
  };
  if (receipt) { same(receipt); if (receipt.status === "CONFIRMED" && receipt.acceptanceId) return { attachmentId: input.attachmentId, acceptanceId: receipt.acceptanceId, checksum, status: "ACCEPTANCE_VERIFIED" as const, duplicate: true }; }
  const pickup = await prisma.reservationPickup.findFirst({ where: { id: input.aggregateId, tenantId: context.tenantId }, include: { reservation: true, items: { include: { resource: true } } } });
  if (!pickup) throw new AppError("NOT_FOUND", "Retirada não encontrada.");
  if (pickup.status !== "IN_PROGRESS" || pickup.version !== input.expectedVersion) throw new AppError("CONFLICT", "Retirada alterada desde a assinatura local.");
  const terms = buildPickupTerms({ reservationCode: pickup.reservation.code, recipientName: pickup.recipientName, resources: pickup.items.map(i => `${i.resource.code} ${i.resource.name}`), conditions: pickup.items.map(i => i.condition) });
  if (terms.version !== input.termsVersion || terms.hash !== input.termsHash) throw new AppError("CONFLICT", "Termos mudaram desde a assinatura local.");
  if (await prisma.pickupAcceptance.findFirst({ where: { tenantId: context.tenantId, pickupId: pickup.id, status: "VERIFIED" }, select: { id: true } })) throw new AppError("CONFLICT", "Esta retirada já possui aceite final.");
  const key = `${context.tenantId}/acceptance/offline-${input.attachmentId}.png`;
  if (receipt) {
    const claimedAt = new Date();
    const claimed = await prisma.offlineSignatureReceipt.updateMany({ where: { id: receipt.id, status: "CLAIMED", claimedAt: { lte: new Date(Date.now() - 120_000) } }, data: { claimedAt } });
    if (claimed.count !== 1) throw new AttachmentBusyError("Assinatura em processamento.");
    receipt = { ...receipt, claimedAt };
  } else {
    try {
      receipt = await prisma.offlineSignatureReceipt.create({ data: { tenantId: context.tenantId, userId: context.user.id, attachmentId: input.attachmentId, clientOperationId: input.clientOperationId, deviceId: input.deviceId, pickupId: input.aggregateId, expectedVersion: input.expectedVersion, checksum, size: input.size, width: input.width, height: input.height, termsVersion: input.termsVersion, termsHash: input.termsHash, capturedAtDevice: new Date(input.capturedAtDevice), status: "CLAIMED", storageKey: key } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const current = await prisma.offlineSignatureReceipt.findUnique({ where: { tenantId_clientOperationId: identity } }) ?? await prisma.offlineSignatureReceipt.findUnique({ where: { tenantId_attachmentId: { tenantId: context.tenantId, attachmentId: input.attachmentId } } });
        if (current) { same(current); if (current.status === "CONFIRMED" && current.acceptanceId) return { attachmentId: input.attachmentId, acceptanceId: current.acceptanceId, checksum, status: "ACCEPTANCE_VERIFIED" as const, duplicate: true }; }
        throw new AttachmentBusyError("Assinatura em processamento.");
      }
      throw error;
    }
  }
  try {
    await storage.put(key, content, "image/png");
    const acceptance = await prisma.$transaction(async tx => {
      const latest = await tx.reservationPickup.findFirst({ where: { id: pickup.id, tenantId: context.tenantId }, include: { reservation: true, items: { include: { resource: true } } } });
      if (!latest || latest.status !== "IN_PROGRESS" || latest.version !== input.expectedVersion) throw new AppError("CONFLICT", "Retirada alterada durante a assinatura.");
      const latestTerms = buildPickupTerms({ reservationCode: latest.reservation.code, recipientName: latest.recipientName, resources: latest.items.map(i => `${i.resource.code} ${i.resource.name}`), conditions: latest.items.map(i => i.condition) });
      if (latestTerms.version !== input.termsVersion || latestTerms.hash !== input.termsHash) throw new AppError("CONFLICT", "Termos mudaram durante a assinatura.");
      const created = await createVerifiedDrawnAcceptance(tx, context, { pickupId: pickup.id, signerName: latest.recipientName, signerDocument: latest.recipientDocument, signerPhone: latest.recipientPhone, terms: latestTerms, storageKey: key, checksum, size: content.byteLength, width: input.width, height: input.height, auditAction: "acceptance.offline_signature_verified" });
      const changed = await tx.offlineSignatureReceipt.updateMany({ where: { id: receipt!.id, status: "CLAIMED", claimedAt: receipt!.claimedAt }, data: { status: "CONFIRMED", acceptanceId: created.id, confirmedAt: new Date() } });
      if (changed.count !== 1) throw new AttachmentBusyError("Assinatura em processamento.");
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { attachmentId: input.attachmentId, acceptanceId: acceptance.id, checksum, status: "ACCEPTANCE_VERIFIED" as const, duplicate: false };
  } catch (error) {
    const owned = await prisma.offlineSignatureReceipt.findFirst({ where: { id: receipt!.id, status: "CLAIMED", claimedAt: receipt!.claimedAt }, select: { id: true } });
    if (owned) { await storage.delete(key).catch(() => undefined); await prisma.offlineSignatureReceipt.updateMany({ where: { id: receipt!.id, status: "CLAIMED", claimedAt: receipt!.claimedAt }, data: { claimedAt: new Date(0) } }); }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new AppError("CONFLICT", "Esta retirada já possui aceite final ou foi alterada.");
    throw error;
  }
}
