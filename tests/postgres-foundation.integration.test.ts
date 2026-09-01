import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/server/auth/password";
import { getCustomer } from "@/server/operational/operational-service";

const run = process.env.RUN_DB_INTEGRATION === "1";
const suite = run ? describe : describe.skip;
const cleanupTenantIds: string[] = [];

suite("PostgreSQL identity and tenant foundation", () => {
  afterAll(async () => {
    for (const tenantId of cleanupTenantIds) {
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.$disconnect();
  });

  it("validates seeded credential, active membership and RBAC in PostgreSQL", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" }, include: { credential: true, memberships: { include: { tenant: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } } });
    expect(user.status).toBe("ACTIVE");
    expect(user.credential && await verifyPassword(process.env.SEED_ADMIN_PASSWORD ?? "UmaSenhaLocalSegura!2026", user.credential.passwordHash)).toBe(true);
    const membership = user.memberships.find((item) => item.status === "ACTIVE" && item.tenant.status === "ACTIVE");
    expect(membership).toBeDefined();
    const permissions = new Set(membership?.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)));
    expect(permissions.has("reservations.create")).toBe(true);
  });

  it("returns not found for a real cross-tenant customer lookup", async () => {
    const tenantA = await prisma.tenant.findUniqueOrThrow({ where: { slug: "empresa-demonstracao" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" } });
    const tenantB = await prisma.tenant.create({ data: { legalName: "Tenant isolado", tradeName: "Tenant isolado", slug: `isolated-${crypto.randomUUID()}` } });
    cleanupTenantIds.push(tenantB.id);
    const customerB = await prisma.customer.create({ data: { tenantId: tenantB.id, type: "COMPANY", legalName: "Cliente B" } });
    const context = { tenantId: tenantA.id, user: { id: user.id }, permissions: new Set<string>(["customers.view"]) };
    await expect(getCustomer(context, customerB.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
