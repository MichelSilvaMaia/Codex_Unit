import { Prisma } from "@prisma/client";
import { AppError } from "@/server/errors/app-error";

export type OperationalContext = { tenantId: string; user: { id: string }; permissions: ReadonlySet<string> };

export function assertTenantOwnership(contextTenantId: string, recordTenantId: string | undefined) {
  if (!recordTenantId || contextTenantId !== recordTenantId) throw new AppError("NOT_FOUND", "Registro não encontrado.");
}

export function mapOperationalError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2003")) {
    throw new AppError("CONFLICT", "Já existe um registro com estes dados ou o relacionamento é inválido.");
  }
  throw error;
}
