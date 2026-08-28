import { getServerSession } from "next-auth";

import { AppError } from "@/server/errors/app-error";
import { authOptions } from "./auth-options";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user?.id) throw new AppError("UNAUTHENTICATED", "Autenticação necessária.");
  return user;
}
