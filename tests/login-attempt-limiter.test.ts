import { describe, expect, it } from "vitest";
import { InMemoryLoginAttemptLimiter } from "@/server/auth/login-attempt-limiter";

describe("login attempt limiter", () => {
  it("blocks after the configured number of failures and resets on success", () => {
    const limiter = new InMemoryLoginAttemptLimiter(2, 60_000, 60_000);
    limiter.recordFailure("key", 1_000);
    expect(limiter.canAttempt("key", 1_001)).toBe(true);
    limiter.recordFailure("key", 1_002);
    expect(limiter.canAttempt("key", 1_003)).toBe(false);
    limiter.recordSuccess("key");
    expect(limiter.canAttempt("key", 1_004)).toBe(true);
  });
});
