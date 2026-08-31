import { describe, expect, it } from "vitest";
import { createSecureToken, isSingleUseTokenValid } from "@/server/auth/secure-token";

describe("single-use tokens", () => {
  it("stores only the hash and validates an unexpired unused token", () => {
    const { token, tokenHash } = createSecureToken();
    expect(tokenHash).not.toBe(token);
    expect(isSingleUseTokenValid({ tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: null }, token)).toBe(true);
  });

  it("rejects expired, used and forged tokens", () => {
    const { token, tokenHash } = createSecureToken();
    expect(isSingleUseTokenValid({ tokenHash, expiresAt: new Date(Date.now() - 1), usedAt: null }, token)).toBe(false);
    expect(isSingleUseTokenValid({ tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() }, token)).toBe(false);
    expect(isSingleUseTokenValid({ tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: null }, "forjado")).toBe(false);
  });
});
