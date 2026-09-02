import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_ENTRA_ID_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_ENTRA_ID_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_ENTRA_ID_TENANT_ID: z.string().min(1).default("common"),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
  OTP_HMAC_SECRET: z.string().min(32).optional(),
  OTP_PROVIDER_MODE: z.enum(["development", "production"]).default("development"),
  OTP_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  ZENVIA_API_TOKEN: z.string().min(1).optional(),
  ZENVIA_API_SECRET: z.string().min(1).optional(),
  ZENVIA_WHATSAPP_FROM: z.string().min(1).optional(),
  ZENVIA_WHATSAPP_OTP_TEMPLATE_ID: z.string().min(1).optional(),
  ZENVIA_WHATSAPP_TEMPLATE_LOCALE: z.string().default("pt_BR"),
  ZENVIA_SMS_FROM: z.string().min(1).optional(),
  ZENVIA_WEBHOOK_TOKEN: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().default("Codex Unit"),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
}).superRefine((env, context) => {
  if (env.OTP_PROVIDER_MODE !== "production") return;
  const whatsapp = env.ZENVIA_API_TOKEN && env.ZENVIA_WHATSAPP_FROM && env.ZENVIA_WHATSAPP_OTP_TEMPLATE_ID;
  const sms = env.ZENVIA_API_TOKEN && env.ZENVIA_SMS_FROM;
  const email = env.RESEND_API_KEY && env.RESEND_FROM_EMAIL;
  if (!whatsapp && !sms && !email) context.addIssue({ code: "custom", path: ["OTP_PROVIDER_MODE"], message: "Production OTP requires a real provider" });
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
