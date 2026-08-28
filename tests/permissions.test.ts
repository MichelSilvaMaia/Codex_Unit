import { describe, expect, it } from "vitest";

import { AppError } from "@/server/errors/app-error";
import { hasPermission, requirePermission, type Permission } from "@/server/authorization/permissions";

describe("permissions", () => {
  const granted = new Set<Permission>(["tenant.read"]);

  it("allows an explicitly granted capability", () => {
    expect(hasPermission(granted, "tenant.read")).toBe(true);
    expect(() => requirePermission(granted, "tenant.read")).not.toThrow();
  });

  it("denies a missing capability", () => {
    expect(() => requirePermission(granted, "tenant.manage")).toThrow(AppError);
  });
});
