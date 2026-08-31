import { MembershipStatus, PrismaClient, RoleScope, TenantStatus, UserStatus } from "@prisma/client";

import { hashPassword } from "../src/server/auth/password";
import { INITIAL_ROLE_MATRIX, PERMISSIONS } from "../src/server/authorization/permissions";

const prisma = new PrismaClient();

const permissionDescriptions: Record<(typeof PERMISSIONS)[number], string> = {
  "tenant.view": "Visualizar informações básicas da empresa",
  "tenant.settings.manage": "Alterar configurações básicas da empresa",
  "users.view": "Visualizar usuários da empresa",
  "users.create": "Criar usuários da empresa",
  "users.update": "Atualizar usuários da empresa",
  "users.disable": "Desativar usuários da empresa",
  "roles.view": "Visualizar papéis e permissões",
  "roles.manage": "Administrar papéis e permissões",
  "memberships.view": "Visualizar vínculos com a empresa",
  "memberships.manage": "Administrar vínculos com a empresa",
  "units.view": "Visualizar unidades operacionais",
  "units.create": "Criar unidades operacionais",
  "units.update": "Atualizar unidades operacionais",
  "units.disable": "Desativar unidades operacionais",
  "customers.view": "Visualizar clientes",
  "customers.create": "Criar clientes",
  "customers.update": "Atualizar clientes",
  "customers.disable": "Desativar clientes",
  "contracts.view": "Visualizar contratos",
  "contracts.create": "Criar contratos",
  "contracts.update": "Atualizar contratos",
  "contracts.disable": "Suspender ou encerrar contratos",
  "resources.view": "Visualizar recursos locáveis",
  "resources.create": "Criar recursos locáveis",
  "resources.update": "Atualizar recursos locáveis",
  "resources.disable": "Desativar recursos locáveis",
  "resource_categories.view": "Visualizar categorias de recursos",
  "resource_categories.manage": "Administrar categorias de recursos",
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("The development seed must not run in production.");

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.test").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { status: UserStatus.ACTIVE },
    create: { email: adminEmail, name: "Administrador de desenvolvimento", status: UserStatus.ACTIVE },
  });

  if (adminPassword) {
    await prisma.passwordCredential.upsert({
      where: { userId: user.id },
      update: { passwordHash: await hashPassword(adminPassword), changedAt: new Date() },
      create: { userId: user.id, passwordHash: await hashPassword(adminPassword) },
    });
  }

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

  const membership = await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { status: MembershipStatus.ACTIVE },
    create: { userId: user.id, tenantId: tenant.id, status: MembershipStatus.ACTIVE },
  });

  const permissions = new Map<string, string>();
  for (const code of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { description: permissionDescriptions[code] },
      create: { code, description: permissionDescriptions[code] },
    });
    permissions.set(code, permission.id);
  }

  const roleNames = { "tenant-admin": "Tenant Admin", manager: "Manager", supervisor: "Supervisor", operator: "Operator" } as const;
  for (const [code, permissionCodes] of Object.entries(INITIAL_ROLE_MATRIX)) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: {},
      create: { tenantId: tenant.id, scope: RoleScope.TENANT, code, name: roleNames[code as keyof typeof roleNames], isSystem: true },
    });
    for (const permissionCode of permissionCodes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissions.get(permissionCode)! } },
        update: {},
        create: { roleId: role.id, permissionId: permissions.get(permissionCode)! },
      });
    }
    if (code === "tenant-admin") {
      await prisma.membershipRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
        update: {},
        create: { membershipId: membership.id, roleId: role.id },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
