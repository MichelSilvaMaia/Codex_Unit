import { MembershipStatus, PrismaClient, TenantStatus, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development seed must not run in production.");
  }

  const user = await prisma.user.upsert({
    where: { email: "admin@example.test" },
    update: {},
    create: {
      email: "admin@example.test",
      name: "Administrador de demonstração",
      status: UserStatus.ACTIVE,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "empresa-demonstracao" },
    update: {},
    create: {
      legalName: "Empresa Demonstração Ltda.",
      tradeName: "Empresa Demonstração",
      slug: "empresa-demonstracao",
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { status: MembershipStatus.ACTIVE },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      status: MembershipStatus.ACTIVE,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
