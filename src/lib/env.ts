import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }
  return parsed.data;
}
