import type { MembershipStatus, TenantStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/server/errors/app-error";
import { requireAuth } from "@/server/auth/session";

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  membershipId: string;
  userId: string;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  tenantId: string;
  status: MembershipStatus;
  tenant: { slug: string; status: TenantStatus };
}

type MembershipLookup = (userId: string, tenantSlug: string) => Promise<MembershipRecord | null>;

export async function resolveTenantContext(
  userId: string,
  tenantSlug: string,
  findMembership: MembershipLookup,
): Promise<TenantContext> {
  const membership = await findMembership(userId, tenantSlug);
  if (!membership || membership.status !== "ACTIVE" || membership.tenant.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "Empresa indisponível para este usuário.");
  }
  return {
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    membershipId: membership.id,
    userId,
  };
}

const findMembership: MembershipLookup = (userId, tenantSlug) =>
  prisma.tenantMembership.findFirst({
    where: { userId, tenant: { slug: tenantSlug } },
    select: {
      id: true,
      userId: true,
      tenantId: true,
      status: true,
      tenant: { select: { slug: true, status: true } },
    },
  });

export async function requireTenant(tenantSlug: string) {
  const user = await requireAuth();
  return resolveTenantContext(user.id, tenantSlug, findMembership);
}
