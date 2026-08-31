import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { UserStatus } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/server/audit/audit-service";
import { hashToken } from "./secure-token";
import { loginAttemptLimiter } from "./login-attempt-limiter";
import { verifyPassword } from "./password";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

const DUMMY_PASSWORD_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5ZGM9eQy7BvY2V7mQ6Yqj4N8Y3wHq8W";

function optionalOAuthProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
  }
  if (process.env.MICROSOFT_ENTRA_ID_CLIENT_ID && process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET) {
    providers.push(AzureADProvider({
      clientId: process.env.MICROSOFT_ENTRA_ID_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_ENTRA_ID_TENANT_ID ?? "common",
    }));
  }
  return providers;
}

export function getEnabledOAuthProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: Boolean(process.env.MICROSOFT_ENTRA_ID_CLIENT_ID && process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET),
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const forwardedFor = request.headers?.["x-forwarded-for"];
        const clientAddress = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor ?? "unknown";
        const attemptKey = hashToken(`${parsed.data.email}:${clientAddress}`);
        if (!loginAttemptLimiter.canAttempt(attemptKey)) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, include: { credential: true } });
        const passwordHash = user?.credential?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const passwordIsValid = await verifyPassword(parsed.data.password, passwordHash);
        if (!user || !passwordIsValid || user.status !== "ACTIVE") {
          loginAttemptLimiter.recordFailure(attemptKey);
          await recordAuditEvent({
            action: "auth.login.rejected",
            entityType: "User",
            entityId: hashToken(parsed.data.email),
            metadata: { reason: "invalid_credentials_or_status" },
          }).catch(() => undefined);
          return null;
        }
        loginAttemptLimiter.recordSuccess(attemptKey);
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    ...optionalOAuthProviders(),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      const email = user.email ?? profile?.email;
      if (!email) return false;
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      return existing?.status === "ACTIVE";
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (!token.sub || !session.user) return session;
      const activeUser = await prisma.user.findFirst({
        where: { id: token.sub, status: "ACTIVE" },
        select: { id: true, name: true, email: true, image: true, status: true },
      });
      session.user.id = activeUser?.id ?? "";
      session.user.name = activeUser?.name ?? null;
      session.user.email = activeUser?.email ?? null;
      session.user.image = activeUser?.image ?? null;
      session.user.status = (activeUser?.status ?? "INACTIVE") as UserStatus;
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      await recordAuditEvent({
        action: "auth.login.succeeded",
        entityType: "User",
        entityId: user.id,
        actorUserId: user.id,
        metadata: { provider: account?.provider ?? "unknown" },
      }).catch(() => undefined);
    },
    async signOut({ token }) {
      if (!token.sub) return;
      await recordAuditEvent({ action: "auth.logout", entityType: "User", entityId: token.sub, actorUserId: token.sub }).catch(() => undefined);
    },
  },
};
