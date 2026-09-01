import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/server/audit/audit-service";
import { requireAuth } from "@/server/auth/session";
import { AppError } from "@/server/errors/app-error";
import { readActiveTenantId, writeActiveTenantCookie } from "./active-tenant-cookie";

const tenantIdSchema = z.string().uuid();

export async function listAvailableTenants(userId: string) {
  return prisma.tenantMembership.findMany({
    where: { userId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: { id: true, tenant: { select: { id: true, slug: true, tradeName: true, status: true } } },
    orderBy: { tenant: { tradeName: "asc" } },
  });
}

export async function selectActiveTenant(rawTenantId: string) {
  const user = await requireAuth();
  const tenantId = tenantIdSchema.parse(rawTenantId);
  const membership = await prisma.tenantMembership.findFirst({
    where: { userId: user.id, tenantId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: { id: true, tenantId: true },
  });
  if (!membership) throw new AppError("NOT_FOUND", "Empresa não encontrada.");
  await writeActiveTenantCookie(membership.tenantId);
  await recordAuditEvent({
    action: "tenant.switched",
    entityType: "Tenant",
    entityId: membership.tenantId,
    tenantId: membership.tenantId,
    actorUserId: user.id,
  });
  return membership;
}

export async function getActiveTenantContext() {
  const user = await requireAuth();
  const tenantId = await readActiveTenantId();
  if (!tenantId) throw new AppError("FORBIDDEN", "Selecione uma empresa.");
  const membership = await prisma.tenantMembership.findFirst({
    where: { userId: user.id, tenantId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: {
      id: true,
      tenantId: true,
      tenant: { select: { slug: true, tradeName: true, timeZone: true } },
      roles: { select: { role: { select: { id: true, tenantId: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
    },
  });
  if (!membership) throw new AppError("NOT_FOUND", "Empresa não encontrada.");
  const permissions = new Set(membership.roles.flatMap(({ role }) =>
    role.tenantId === membership.tenantId ? role.permissions.map(({ permission }) => permission.code) : [],
  ));
  return {
    user,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    tenantName: membership.tenant.tradeName,
    timeZone: membership.tenant.timeZone,
    membershipId: membership.id,
    permissions,
  };
}
