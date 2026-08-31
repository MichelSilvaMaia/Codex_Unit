import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/server/audit/audit-service";
import { AppError } from "@/server/errors/app-error";
import { createSecureToken, hashToken, isSingleUseTokenValid } from "./secure-token";
import { hashPassword } from "./password";

export async function createPasswordReset(userId: string) {
  const { token, tokenHash } = createSecureToken();
  const reset = await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + 60 * 60_000) },
    select: { id: true, expiresAt: true },
  });
  return { reset, token };
}

export async function consumePasswordReset(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(newPassword);
  const userId = await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!reset || !isSingleUseTokenValid(reset, token)) throw new AppError("NOT_FOUND", "Token inválido ou expirado.");
    await tx.passwordCredential.upsert({
      where: { userId: reset.userId },
      update: { passwordHash, changedAt: new Date() },
      create: { userId: reset.userId, passwordHash },
    });
    await tx.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    return reset.userId;
  });
  await recordAuditEvent({ action: "auth.password_reset.consumed", entityType: "User", entityId: userId, actorUserId: userId });
}
