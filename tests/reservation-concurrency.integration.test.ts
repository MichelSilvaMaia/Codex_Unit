import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createReservation } from "@/server/reservations/reservation-service";
import { AppError } from "@/server/errors/app-error";

const run = process.env.RUN_DB_INTEGRATION === "1";
const suite = run ? describe : describe.skip;

suite("PostgreSQL reservation concurrency", () => {
  const createdIds: string[] = [];
  afterAll(async () => {
    if (createdIds.length) await prisma.reservation.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  it("allows only one concurrent overlapping reservation", async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "empresa-demonstracao" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" } });
    const customer = await prisma.customer.findUniqueOrThrow({ where: { tenantId_normalizedDocument: { tenantId: tenant.id, normalizedDocument: "DEMO0001" } } });
    const unit = await prisma.unit.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "BASE-SP" } } });
    const resource = await prisma.resource.findUniqueOrThrow({ where: { tenantId_code: { tenantId: tenant.id, code: "CAB-001" } } });
    const context = { tenantId: tenant.id, user: { id: user.id }, permissions: new Set<string>(["reservations.create"]) };
    const base = { customerId: customer.id, unitId: unit.id, title: "Teste concorrente", startAtLocal: "2030-06-10T10:00", endAtLocal: "2030-06-10T12:00", resourceIds: [resource.id], status: "PENDING" };
    const settled = await Promise.allSettled([createReservation(context, base), createReservation(context, { ...base, title: "Teste concorrente B" })]);
    for (const result of settled) if (result.status === "fulfilled") createdIds.push(result.value.id);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: expect.any(AppError) });
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });
  });
});
