import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signActiveTenant, verifyActiveTenant } from "@/server/tenancy/active-tenant-cookie";

describe("active tenant cookie", () => {
  const previous = process.env.AUTH_SECRET;
  beforeEach(() => { process.env.AUTH_SECRET = "test-secret-with-at-least-thirty-two-characters"; });
  afterEach(() => { process.env.AUTH_SECRET = previous; });

  it("accepts a signed tenant and rejects tampering", () => {
    const signed = signActiveTenant("tenant-a", 1_000);
    expect(verifyActiveTenant(signed, 2_000)?.tenantId).toBe("tenant-a");
    expect(verifyActiveTenant(`${signed}tampered`, 2_000)).toBeNull();
  });

  it("rejects expired context", () => {
    const signed = signActiveTenant("tenant-a", 1_000);
    expect(verifyActiveTenant(signed, 1_000 + 9 * 60 * 60_000)).toBeNull();
  });
});
