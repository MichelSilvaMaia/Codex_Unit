import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/server/audit/audit-service";
import { createSecureToken, isSingleUseTokenValid } from "@/server/auth/secure-token";
import { AppError } from "@/server/errors/app-error";

const invitationInput = z.object({ tenantId: z.string().uuid(), email: z.string().trim().toLowerCase().email(), invitedByUserId: z.string().uuid() });

export async function createTenantInvitation(input: z.input<typeof invitationInput>) {
  const data = invitationInput.parse(input);
  const { token, tokenHash } = createSecureToken();
  const invitation = await prisma.tenantInvitation.create({
    data: { ...data, tokenHash, expiresAt: new Date(Date.now() + 72 * 60 * 60_000) },
    select: { id: true, tenantId: true, email: true, expiresAt: true },
  });
  await recordAuditEvent({ action: "membership.invited", entityType: "TenantInvitation", entityId: invitation.id, tenantId: data.tenantId, actorUserId: data.invitedByUserId });
  return { invitation, token };
}

export async function acceptTenantInvitation(token: string, userId: string) {
  const tokenHash = (await import("@/server/auth/secure-token")).hashToken(token);
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.tenantInvitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.status !== "PENDING" || !isSingleUseTokenValid(invitation, token)) {
      throw new AppError("NOT_FOUND", "Convite inválido ou expirado.");
    }
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    if (!user || user.status !== "ACTIVE" || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError("FORBIDDEN", "Este convite não pertence ao usuário autenticado.");
    }
    const membership = await tx.tenantMembership.upsert({
      where: { userId_tenantId: { userId, tenantId: invitation.tenantId } },
      update: { status: "ACTIVE" },
      create: { userId, tenantId: invitation.tenantId, status: "ACTIVE" },
    });
    await tx.tenantInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    return membership;
  });
}
