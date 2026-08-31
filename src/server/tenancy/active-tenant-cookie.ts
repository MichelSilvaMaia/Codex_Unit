import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "codex_unit_active_tenant";
const MAX_AGE_SECONDS = 8 * 60 * 60;

interface TenantCookiePayload {
  tenantId: string;
  expiresAt: number;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET is required to sign tenant context.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signActiveTenant(tenantId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ tenantId, expiresAt: now + MAX_AGE_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyActiveTenant(value: string, now = Date.now()): TenantCookiePayload | null {
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature) return null;
  const actual = Buffer.from(suppliedSignature);
  const expected = Buffer.from(signature(payload));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TenantCookiePayload;
    return parsed.tenantId && parsed.expiresAt > now ? parsed : null;
  } catch {
    return null;
  }
}

export async function readActiveTenantId() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value ? verifyActiveTenant(value)?.tenantId ?? null : null;
}

export async function writeActiveTenantCookie(tenantId: string) {
  (await cookies()).set(COOKIE_NAME, signActiveTenant(tenantId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearActiveTenantCookie() {
  (await cookies()).delete(COOKIE_NAME);
}
