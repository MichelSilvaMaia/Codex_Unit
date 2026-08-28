export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const statusByCode: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = statusByCode[code];
  }
}

export function toPublicError(error: unknown) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, status: error.status };
  }
  return {
    code: "INTERNAL_ERROR" as const,
    message: "Não foi possível concluir a operação. Tente novamente.",
    status: 500,
  };
}
