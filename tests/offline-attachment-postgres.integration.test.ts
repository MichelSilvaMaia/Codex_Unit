import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { syncMaintenanceMutation } from "@/server/offline/sync-maintenance";
import { syncMaintenanceAttachment } from "@/server/offline/sync-attachment";
import type { StorageProvider } from "@/server/storage/storage-provider";

const suite = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;
suite("offline evidence receipts on PostgreSQL", () => {
  const orders: string[] = [], resources: string[] = [];
  const objects = new Map<string, Uint8Array>();
  const storage: StorageProvider = { async put(key, bytes, contentType) { objects.set(key, bytes); return { key, contentType, size: bytes.length }; }, async get(key) { return objects.get(key)!; }, async delete(key) { objects.delete(key); }, async getSignedReadUrl() { return ""; } };
  afterAll(async () => {
    await prisma.offlineAttachmentReceipt.deleteMany({ where: { aggregateId: { in: orders } } });
    await prisma.clientOperation.deleteMany({ where: { aggregateId: { in: orders } } });
    await prisma.maintenanceEvidence.deleteMany({ where: { maintenanceOrderId: { in: orders } } });
    await prisma.maintenanceOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.resource.deleteMany({ where: { id: { in: resources } } });
    await prisma.$disconnect();
  });
  async function fixture() {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "empresa-demonstracao" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" } });
    const unit = await prisma.unit.findFirstOrThrow({ where: { tenantId: tenant.id } });
    const category = await prisma.resourceCategory.findFirstOrThrow({ where: { tenantId: tenant.id } });
    const resource = await prisma.resource.create({ data: { tenantId: tenant.id, unitId: unit.id, categoryId: category.id, code: `EVID-${randomUUID()}`, name: "Teste de evidência", operationalStatus: "MAINTENANCE" } });
    resources.push(resource.id);
    const order = await prisma.maintenanceOrder.create({ data: { tenantId: tenant.id, resourceId: resource.id, sourceType: "MANUAL", code: `OS-${randomUUID()}`, title: "Evidência", description: "Teste", openedByUserId: user.id } });
    orders.push(order.id);
    const context = { tenantId: tenant.id, user: { id: user.id }, permissions: new Set(["maintenance.add_evidence"]) };
    const deviceId = randomUUID(), clientOperationId = randomUUID();
    await syncMaintenanceMutation(context, { operationType: "MAINTENANCE_ADD_EVIDENCE", clientOperationId, deviceId, tenantId: tenant.id, userId: user.id, aggregateId: order.id, expectedVersion: order.version, schemaVersion: 1, payload: { description: "Evidência de manutenção" } });
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const input = { attachmentId: randomUUID(), clientOperationId, deviceId, tenantId: tenant.id, userId: user.id, aggregateId: order.id, type: "DIAGNOSIS", checksum: createHash("sha256").update(bytes).digest("hex") };
    return { context, order, input, bytes };
  }
  it("ACKs one evidence for repeat and concurrent sends", async () => {
    const f = await fixture();
    const concurrent = await Promise.allSettled([syncMaintenanceAttachment(f.context, f.input, f.bytes, "image/png", storage), syncMaintenanceAttachment(f.context, f.input, f.bytes, "image/png", storage)]);
    expect(concurrent.some(r => r.status === "fulfilled")).toBe(true);
    const repeat = await syncMaintenanceAttachment(f.context, f.input, f.bytes, "image/png", storage);
    expect(repeat.duplicate).toBe(true);
    expect(repeat.status).toBe("SERVER_CONFIRMED");
    expect(await prisma.maintenanceEvidence.count({ where: { maintenanceOrderId: f.order.id } })).toBe(1);
    expect(await prisma.offlineAttachmentReceipt.count({ where: { aggregateId: f.order.id, status: "CONFIRMED" } })).toBe(1);
    expect(objects.size).toBeGreaterThan(0);
  });
  it("rejects checksum collision, forged tenant/user, revoked RBAC and malformed file", async () => {
    const f = await fixture();
    await syncMaintenanceAttachment(f.context, f.input, f.bytes, "image/png", storage);
    const different = new Uint8Array([...f.bytes, 4]);
    await expect(syncMaintenanceAttachment(f.context, { ...f.input, checksum: createHash("sha256").update(different).digest("hex") }, different, "image/png", storage)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(syncMaintenanceAttachment(f.context, { ...f.input, tenantId: randomUUID() }, f.bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncMaintenanceAttachment({ ...f.context, user: { id: randomUUID() } }, { ...f.input, userId: randomUUID() }, f.bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncMaintenanceAttachment({ ...f.context, permissions: new Set() }, f.input, f.bytes, "image/png", storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncMaintenanceAttachment(f.context, { ...f.input, attachmentId: randomUUID() }, new Uint8Array([1,2,3]), "image/png", storage)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
  it("keeps a retryable claim after storage failure, then confirms exactly once", async () => {
    const f = await fixture();
    const failing: StorageProvider = { ...storage, async put() { throw new Error("storage unavailable"); } };
    await expect(syncMaintenanceAttachment(f.context, f.input, f.bytes, "image/png", failing)).rejects.toThrow("storage unavailable");
    expect(await prisma.maintenanceEvidence.count({ where: { maintenanceOrderId: f.order.id } })).toBe(0);
    const ack = await syncMaintenanceAttachment(f.context, f.input, f.bytes, "image/png", storage);
    expect(ack.status).toBe("SERVER_CONFIRMED");
    expect(await prisma.maintenanceEvidence.count({ where: { maintenanceOrderId: f.order.id } })).toBe(1);
  });
});
