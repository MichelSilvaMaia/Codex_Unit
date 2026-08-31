import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface SingleUseTokenRecord {
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSecureToken(byteLength = 32) {
  const token = randomBytes(byteLength).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function tokenMatches(token: string, tokenHash: string) {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isSingleUseTokenValid(record: SingleUseTokenRecord, token: string, now = new Date()) {
  return !record.usedAt && record.expiresAt > now && tokenMatches(token, record.tokenHash);
}
