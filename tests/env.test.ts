import { describe, expect, it } from "vitest";

import { getServerEnv } from "@/lib/env";

describe("getServerEnv", () => {
  it("accepts a complete secure configuration", () => {
    expect(
      getServerEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
        AUTH_SECRET: "a-secure-secret-with-at-least-32-characters",
      }),
    ).toMatchObject({ LOG_LEVEL: "info" });
  });

  it("rejects missing mandatory secrets", () => {
    expect(() => getServerEnv({})).toThrow("Invalid server environment configuration");
  });
});
