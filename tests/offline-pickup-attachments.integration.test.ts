import { createHash, randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildPickupTerms } from "@/server/acceptance/acceptance-terms";
import { captureDrawnSignature } from "@/server/acceptance/acceptance-service";
import { syncPickupAttachment } from "@/server/offline/sync-attachment";
import { syncPickupIntent } from "@/server/offline/sync-pickup";
import { syncOfflineSignature } from "@/server/offline/sync-signature";
import { syncPickupCompletion } from "@/server/offline/sync-pickup-complete";
import { validateDrawnPng } from "@/server/offline/signature-png";
import { completePickup, inspectPickup, startPickup } from "@/server/pickups/pickup-service";
import { approveReservation, createReservation, submitReservationForApproval, transitionReservation } from "@/server/reservations/reservation-service";
import type { StorageProvider } from "@/server/storage/storage-provider";

const suite = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const png = (ink = true) => {
  const width = 300, height = 120, raw = Buffer.alloc((width * 4 + 1) * height);
  if (ink) raw[1 + 3] = 255;
  const chunk = (name: string, value: Buffer) => { const head = Buffer.alloc(8), tail = Buffer.alloc(4); head.writeUInt32BE(value.length); head.write(name, 4, "ascii"); return Buffer.concat([head, value, tail]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
};

suite("offline pickup evidence and signature on PostgreSQL", () => {
  const reservations: string[] = [], resources: string[] = [];
  const objects = new Map<string, Uint8Array>();
  const storage: StorageProvider = { async put(key, bytes, contentType) { objects.set(key, bytes); return { key, contentType, size: bytes.length }; }, async get(key) { return objects.get(key)!; }, async delete(key) { objects.delete(key); }, async getSignedReadUrl() { return ""; } };
  afterEach(async () => {
    for (const reservationId of reservations.splice(0)) {
      const pickupIds = (await prisma.reservationPickup.findMany({ where: { reservationId }, select: { id: true } })).map(row => row.id);
      await prisma.resourceCustodyEvent.deleteMany({ where: { pickupId: { in: pickupIds } } });
      await prisma.offlineSignatureReceipt.deleteMany({ where: { pickupId: { in: pickupIds } } });
      await prisma.offlineAttachmentReceipt.deleteMany({ where: { aggregateId: { in: pickupIds } } });
      await prisma.clientOperation.deleteMany({ where: { aggregateId: { in: pickupIds } } });
      await prisma.reservationPickup.deleteMany({ where: { reservationId } });
      await prisma.reservation.deleteMany({ where: { id: reservationId } });
    }
    for (const id of resources.splice(0)) await prisma.resource.delete({ where: { id } });
    objects.clear();
  });
  afterAll(async () => { await prisma.$disconnect(); });
  async function fixture(offlineInspection = false) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "empresa-demonstracao" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" } });
    const customer = await prisma.customer.findUniqueOrThrow({ where: { tenantId_normalizedDocument: { tenantId: tenant.id, normalizedDocument: "DEMO0001" } } });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "BASE-SP" } } });
    const category = await prisma.resourceCategory.findFirstOrThrow({ where: { tenantId: tenant.id } });
    const resource = await prisma.resource.create({ data: { tenantId: tenant.id, unitId: unit.id, categoryId: category.id, code: `PICK-${randomUUID()}`, name: "Veículo de teste", operationalStatus: "AVAILABLE" } });
    resources.push(resource.id);
    const context = { tenantId: tenant.id, user: { id: user.id }, permissions: new Set<string>(["reservations.create", "reservations.submit", "reservations.approve", "reservations.confirm", "pickups.start", "pickups.inspect", "pickups.add_evidence", "pickups.complete", "pickups.acceptance.capture_signature"]) };
    const reservation = await createReservation(context, { customerId: customer.id, unitId: unit.id, title: "Pickup offline", startAtLocal: "2026-08-20T08:00", endAtLocal: "2026-08-20T10:00", resourceIds: [resource.id], status: "DRAFT" });
    reservations.push(reservation.id);
    await submitReservationForApproval(context, reservation.id); await approveReservation(context, reservation.id); await transitionReservation(context, reservation.id, "CONFIRMED");
    const pickup = await startPickup(context, reservation.id, { recipientName: "Motorista de teste" });
    const item = await prisma.reservationPickupItem.findFirstOrThrow({ where: { pickupId: pickup.id } });
    if (!offlineInspection) await inspectPickup(context, pickup.id, { items: [{ pickupItemId: item.id, condition: "OK" }] }, pickup.version);
    const current = await prisma.reservationPickup.findUniqueOrThrow({ where: { id: pickup.id } });
    const terms = buildPickupTerms({ reservationCode: reservation.code, recipientName: current.recipientName, resources: [`${resource.code} ${resource.name}`], conditions: ["OK"] });
    const clientOperationId = randomUUID(), deviceId = randomUUID();
    const intent = { operationType: "PICKUP_ATTACHMENTS", clientOperationId, deviceId, tenantId: tenant.id, userId: user.id, aggregateId: pickup.id, expectedVersion: current.version, schemaVersion: 1, payload: { description: "Anexos de retirada", ...(offlineInspection ? { inspection: { recipientName: current.recipientName, recipientDocument: "", recipientPhone: "", vehiclePlate: "", notes: "", items: [{ pickupItemId: item.id, condition: "OK", notes: "" }], savedAt: new Date().toISOString() } } : {}) } };
    const prepared = await syncPickupIntent(context, intent);
    return { context, pickup: current, resource, item, terms, intent, serverVersion: prepared.serverVersion };
  }
  it("ACKs one Pickup evidence, rejects changed checksum and keeps resource/custody unchanged", async () => {
    const f = await fixture(), bytes = new Uint8Array([137,80,78,71,1,2,3]);
    const metadata = { purpose: "PICKUP_EVIDENCE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, pickupItemId: f.item.id, expectedVersion: f.pickup.version, type: "OUTPUT_CONDITION", checksum: hash(bytes) };
    const first = await syncPickupAttachment(f.context, metadata, bytes, "image/png", storage);
    expect(first.status).toBe("SERVER_CONFIRMED");
    expect((await syncPickupAttachment(f.context, metadata, bytes, "image/png", storage)).duplicate).toBe(true);
    expect(await prisma.operationalEvidence.count({ where: { pickupId: f.pickup.id } })).toBe(1);
    const changed = new Uint8Array([...bytes, 4]);
    await expect(syncPickupAttachment(f.context, { ...metadata, checksum: hash(changed) }, changed, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await prisma.reservationPickup.findUniqueOrThrow({ where: { id: f.pickup.id } })).status).toBe("IN_PROGRESS");
    expect((await prisma.resource.findUniqueOrThrow({ where: { id: f.resource.id } })).operationalStatus).toBe("AVAILABLE");
    expect(await prisma.resourceCustodyEvent.count({ where: { pickupId: f.pickup.id } })).toBe(0);
  });
  it("verifies one idempotent signature/Acceptance and rejects checksum reuse", async () => {
    const f = await fixture(), bytes = png();
    const metadata = { purpose: "PICKUP_SIGNATURE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, expectedVersion: f.pickup.version, checksum: hash(bytes), mimeType: "image/png", size: bytes.length, width: 300, height: 120, termsVersion: f.terms.version, termsHash: f.terms.hash, capturedAtDevice: new Date().toISOString() };
    const first = await syncOfflineSignature(f.context, metadata, bytes, "image/png", storage);
    expect(first.status).toBe("ACCEPTANCE_VERIFIED");
    expect((await syncOfflineSignature(f.context, metadata, bytes, "image/png", storage)).duplicate).toBe(true);
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: f.pickup.id, status: "VERIFIED" } })).toBe(1);
    expect(await prisma.acceptanceSignature.count({ where: { acceptanceId: first.acceptanceId } })).toBe(1);
    const changed = png(); changed[changed.length - 1] = 1;
    await expect(syncOfflineSignature(f.context, { ...metadata, checksum: hash(changed) }, changed, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await prisma.reservationPickup.findUniqueOrThrow({ where: { id: f.pickup.id } })).status).toBe("IN_PROGRESS");
  });
  it("rejects blank signatures, changed terms/version, another user's data and revoked RBAC", async () => {
    expect(() => validateDrawnPng(png(false), 300, 120)).toThrow();
    const f = await fixture(), bytes = png();
    const metadata = { purpose: "PICKUP_SIGNATURE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, expectedVersion: f.pickup.version, checksum: hash(bytes), mimeType: "image/png", size: bytes.length, width: 300, height: 120, termsVersion: f.terms.version, termsHash: f.terms.hash, capturedAtDevice: new Date().toISOString() };
    await expect(syncOfflineSignature({ ...f.context, permissions: new Set() }, metadata, bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncOfflineSignature(f.context, { ...metadata, tenantId: randomUUID() }, bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncOfflineSignature(f.context, { ...metadata, userId: randomUUID() }, bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await prisma.reservationPickup.update({ where: { id: f.pickup.id }, data: { recipientName: "Outro destinatário" } });
    await expect(syncOfflineSignature(f.context, metadata, bytes, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: f.pickup.id, status: "VERIFIED" } })).toBe(0);
    await prisma.reservationPickup.update({ where: { id: f.pickup.id }, data: { recipientName: f.pickup.recipientName, version: { increment: 1 } } });
    await expect(syncOfflineSignature(f.context, metadata, bytes, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("loses cleanly when online Acceptance wins before offline replay", async () => {
    const f = await fixture(), bytes = png();
    const metadata = { purpose: "PICKUP_SIGNATURE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, expectedVersion: f.pickup.version, checksum: hash(bytes), mimeType: "image/png", size: bytes.length, width: 300, height: 120, termsVersion: f.terms.version, termsHash: f.terms.hash, capturedAtDevice: new Date().toISOString() };
    await captureDrawnSignature(f.context, f.pickup.id, { content: bytes, width: 300, height: 120 }, storage);
    await expect(syncOfflineSignature(f.context, metadata, bytes, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: f.pickup.id, status: "VERIFIED" } })).toBe(1);
    expect(await prisma.acceptanceSignature.count({ where: { acceptance: { pickupId: f.pickup.id } } })).toBe(1);
  });
  it("permits exactly one final Acceptance in a simultaneous offline/online race", async () => {
    const f = await fixture(), bytes = png();
    const metadata = { purpose: "PICKUP_SIGNATURE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, expectedVersion: f.pickup.version, checksum: hash(bytes), mimeType: "image/png", size: bytes.length, width: 300, height: 120, termsVersion: f.terms.version, termsHash: f.terms.hash, capturedAtDevice: new Date().toISOString() };
    const outcomes = await Promise.allSettled([syncOfflineSignature(f.context, metadata, bytes, "image/png", storage), captureDrawnSignature(f.context, f.pickup.id, { content: bytes, width: 300, height: 120 }, storage)]);
    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: f.pickup.id, status: "VERIFIED" } })).toBe(1);
    expect(await prisma.acceptanceSignature.count({ where: { acceptance: { pickupId: f.pickup.id } } })).toBe(1);
    expect((await prisma.reservationPickup.findUniqueOrThrow({ where: { id: f.pickup.id } })).status).toBe("IN_PROGRESS");
  });
  it("rejects stale evidence and account/permission tampering", async () => {
    const f = await fixture(), bytes = new Uint8Array([137,80,78,71,1,2,3]);
    const metadata = { purpose: "PICKUP_EVIDENCE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, pickupItemId: f.item.id, expectedVersion: f.pickup.version, type: "DAMAGE", checksum: hash(bytes) };
    await expect(syncPickupAttachment({ ...f.context, permissions: new Set() }, metadata, bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncPickupAttachment(f.context, { ...metadata, userId: randomUUID() }, bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncPickupAttachment(f.context, { ...metadata, pickupItemId: randomUUID() }, bytes, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
    await prisma.reservationPickup.update({ where: { id: f.pickup.id }, data: { version: { increment: 1 } } });
    await expect(syncPickupAttachment(f.context, metadata, bytes, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.operationalEvidence.count({ where: { pickupId: f.pickup.id } })).toBe(0);
  });
  it("recovers a signature storage failure without an orphan Acceptance or duplicate receipt", async () => {
    const f = await fixture(), bytes = png();
    const metadata = { purpose: "PICKUP_SIGNATURE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, expectedVersion: f.pickup.version, checksum: hash(bytes), mimeType: "image/png", size: bytes.length, width: 300, height: 120, termsVersion: f.terms.version, termsHash: f.terms.hash, capturedAtDevice: new Date().toISOString() };
    const failing: StorageProvider = { ...storage, async put() { throw new Error("storage unavailable"); } };
    await expect(syncOfflineSignature(f.context, metadata, bytes, "image/png", failing)).rejects.toThrow("storage unavailable");
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: f.pickup.id, status: "VERIFIED" } })).toBe(0);
    const ack = await syncOfflineSignature(f.context, metadata, bytes, "image/png", storage);
    expect(ack.status).toBe("ACCEPTANCE_VERIFIED");
    expect(await prisma.offlineSignatureReceipt.count({ where: { pickupId: f.pickup.id, status: "CONFIRMED" } })).toBe(1);
  });
  async function acceptedFixture() {
    const f = await fixture(true), image = new Uint8Array([137,80,78,71,1,2,3]);
    await syncPickupAttachment(f.context, { purpose: "PICKUP_EVIDENCE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, pickupItemId: f.item.id, expectedVersion: f.serverVersion, type: "OUTPUT_CONDITION", checksum: hash(image) }, image, "image/png", storage);
    const bytes = png();
    await syncOfflineSignature(f.context, { purpose: "PICKUP_SIGNATURE", attachmentId: randomUUID(), clientOperationId: f.intent.clientOperationId, deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, expectedVersion: f.serverVersion, checksum: hash(bytes), mimeType: "image/png", size: bytes.length, width: 300, height: 120, termsVersion: f.terms.version, termsHash: f.terms.hash, capturedAtDevice: new Date().toISOString() }, bytes, "image/png", storage);
    const completion = { operationType: "PICKUP_COMPLETE", clientOperationId: randomUUID(), deviceId: f.intent.deviceId, tenantId: f.context.tenantId, userId: f.context.user.id, aggregateId: f.pickup.id, expectedVersion: f.serverVersion, dependsOnOperationIds: [f.intent.clientOperationId], schemaVersion: 1, payload: { description: "Concluir retirada" } };
    return { ...f, completion };
  }
  it("keeps local stages non-final, then returns a durable FULL ACK and idempotent lost-response retry", async () => {
    const f = await acceptedFixture();
    expect((await prisma.reservationPickup.findUniqueOrThrow({ where: { id: f.pickup.id } })).status).toBe("IN_PROGRESS");
    expect((await prisma.resource.findUniqueOrThrow({ where: { id: f.resource.id } })).operationalStatus).toBe("AVAILABLE");
    expect(await prisma.resourceCustodyEvent.count({ where: { pickupId: f.pickup.id } })).toBe(0);
    const ack = await syncPickupCompletion(f.context, f.completion);
    expect(ack.fullAck).toBe(true); expect(ack.pickupStatus).toBe("COMPLETED");
    expect(ack.resourceResults).toEqual([{ resourceId: f.resource.id, operationalStatus: "IN_USE" }]);
    expect(ack.custodyEventIds).toHaveLength(1);
    expect(await syncPickupCompletion(f.context, f.completion)).toEqual(ack);
    expect(await prisma.resourceCustodyEvent.count({ where: { pickupId: f.pickup.id, type: "RELEASED_TO_RECIPIENT" } })).toBe(1);
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: f.pickup.id, status: "VERIFIED" } })).toBe(1);
    expect(await prisma.operationalEvidence.count({ where: { pickupId: f.pickup.id } })).toBe(1);
    expect((await prisma.reservationPickup.findUniqueOrThrow({ where: { id: f.pickup.id } })).status).toBe("COMPLETED");
    expect((await prisma.resource.findUniqueOrThrow({ where: { id: f.resource.id } })).operationalStatus).toBe("IN_USE");
    await expect(syncPickupCompletion(f.context, { ...f.completion, clientOperationId: randomUUID() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rejects stale version, invalid reservation and unavailable resource without partial custody", async () => {
    const stale = await acceptedFixture();
    await prisma.reservationPickup.update({ where: { id: stale.pickup.id }, data: { version: { increment: 1 } } });
    await expect(syncPickupCompletion(stale.context, stale.completion)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.resourceCustodyEvent.count({ where: { pickupId: stale.pickup.id } })).toBe(0);
    const invalidResource = await acceptedFixture();
    await prisma.resource.update({ where: { id: invalidResource.resource.id }, data: { operationalStatus: "MAINTENANCE" } });
    await expect(syncPickupCompletion(invalidResource.context, invalidResource.completion)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await prisma.reservationPickup.findUniqueOrThrow({ where: { id: invalidResource.pickup.id } })).status).toBe("IN_PROGRESS");
    const invalidReservation = await acceptedFixture();
    await prisma.reservation.update({ where: { id: invalidReservation.pickup.reservationId }, data: { status: "CANCELLED" } });
    await expect(syncPickupCompletion(invalidReservation.context, invalidReservation.completion)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.resourceCustodyEvent.count({ where: { pickupId: invalidReservation.pickup.id } })).toBe(0);
  });
  it("allows only one completion when offline and online devices race", async () => {
    const f = await acceptedFixture();
    const outcomes = await Promise.allSettled([syncPickupCompletion(f.context, f.completion), completePickup(f.context, f.pickup.id, f.serverVersion)]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.resourceCustodyEvent.count({ where: { pickupId: f.pickup.id, type: "RELEASED_TO_RECIPIENT" } })).toBe(1);
    expect((await prisma.resource.findUniqueOrThrow({ where: { id: f.resource.id } })).operationalStatus).toBe("IN_USE");
  });
  it("enforces RBAC, tenant/user ownership and dependency receipt on offline completion", async () => {
    const f = await acceptedFixture();
    await expect(syncPickupCompletion({ ...f.context, permissions: new Set() }, f.completion)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncPickupCompletion(f.context, { ...f.completion, tenantId: randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncPickupCompletion(f.context, { ...f.completion, userId: randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncPickupCompletion(f.context, { ...f.completion, dependsOnOperationIds: [randomUUID()] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.resourceCustodyEvent.count({ where: { pickupId: f.pickup.id } })).toBe(0);
  });
});
