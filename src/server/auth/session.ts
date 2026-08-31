import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/server/errors/app-error";
import { authOptions } from "./auth-options";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return prisma.user.findFirst({
    where: { id: session.user.id, status: "ACTIVE" },
    select: { id: true, name: true, email: true, image: true, status: true },
  });
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Autenticação necessária.");
  return user;
}
