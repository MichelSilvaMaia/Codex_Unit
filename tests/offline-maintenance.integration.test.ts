import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { syncMaintenanceMutation } from "@/server/offline/sync-maintenance";

const suite = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;
suite("offline maintenance receipts on PostgreSQL", () => {
  const resources: string[] = [];
  const orders: string[] = [];
  afterAll(async () => {
    await prisma.clientOperation.deleteMany({ where: { aggregateId: { in: orders } } });
    await prisma.maintenanceDiagnosis.deleteMany({ where: { maintenanceOrderId: { in: orders } } });
    await prisma.maintenanceActivity.deleteMany({ where: { maintenanceOrderId: { in: orders } } });
    await prisma.maintenanceOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.resource.deleteMany({ where: { id: { in: resources } } });
    await prisma.$disconnect();
  });
  async function fixture() {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "empresa-demonstracao" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" } });
    const unit = await prisma.unit.findFirstOrThrow({ where: { tenantId: tenant.id } });
    const category = await prisma.resourceCategory.findFirstOrThrow({ where: { tenantId: tenant.id } });
    const resource = await prisma.resource.create({ data: { tenantId: tenant.id, unitId: unit.id, categoryId: category.id, code: `OFF-${randomUUID()}`, name: "Recurso de teste offline", operationalStatus: "MAINTENANCE" } });
    resources.push(resource.id);
    const order = await prisma.maintenanceOrder.create({ data: { tenantId: tenant.id, resourceId: resource.id, sourceType: "MANUAL", code: `OS-${randomUUID()}`, title: "Teste offline", description: "Validação de sincronização", openedByUserId: user.id } });
    orders.push(order.id);
    return { context: { tenantId: tenant.id, user: { id: user.id }, permissions: new Set(["maintenance.diagnose", "maintenance.perform"]) }, order };
  }
  it("applies once, returns duplicate receipt and rejects stale version", async () => {
    const { context, order } = await fixture();
    const operation = { operationType: "MAINTENANCE_ADD_DIAGNOSIS", clientOperationId: randomUUID(), deviceId: randomUUID(), tenantId: context.tenantId, userId: context.user.id, aggregateId: order.id, expectedVersion: order.version, schemaVersion: 1, payload: { description: "Inspeção detalhada" } };
    const first = await syncMaintenanceMutation(context, operation);
    const repeated = await syncMaintenanceMutation(context, operation);
    expect(first.duplicate).toBe(false);
    expect(repeated.duplicate).toBe(true);
    expect(repeated.resultReference).toBe(first.resultReference);
    expect(await prisma.maintenanceDiagnosis.count({ where: { maintenanceOrderId: order.id } })).toBe(1);
    await expect(syncMaintenanceMutation(context, { ...operation, clientOperationId: randomUUID() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rejects forged tenant/user and revoked permission", async () => {
    const { context, order } = await fixture();
    const input = { operationType: "MAINTENANCE_ADD_ACTIVITY", clientOperationId: randomUUID(), deviceId: randomUUID(), tenantId: context.tenantId, userId: context.user.id, aggregateId: order.id, expectedVersion: order.version, schemaVersion: 1, payload: { type: "TEST", description: "Teste operacional" } };
    await expect(syncMaintenanceMutation(context, { ...input, tenantId: randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(syncMaintenanceMutation({ ...context, permissions: new Set() }, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.maintenanceActivity.count({ where: { maintenanceOrderId: order.id } })).toBe(0);
  });
  it("allows only one commit for two simultaneous sends of one operation", async () => {
    const { context, order } = await fixture();
    const input = { operationType: "MAINTENANCE_ADD_ACTIVITY", clientOperationId: randomUUID(), deviceId: randomUUID(), tenantId: context.tenantId, userId: context.user.id, aggregateId: order.id, expectedVersion: order.version, schemaVersion: 1, payload: { type: "TEST", description: "Teste de concorrência" } };
    const results = await Promise.allSettled([syncMaintenanceMutation(context, input), syncMaintenanceMutation(context, input)]);
    expect(results.filter(result => result.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    expect(await prisma.maintenanceActivity.count({ where: { maintenanceOrderId: order.id } })).toBe(1);
    expect(await prisma.clientOperation.count({ where: { aggregateId: order.id } })).toBe(1);
  });
});
