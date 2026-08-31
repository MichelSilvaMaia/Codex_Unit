import { describe, expect, it } from "vitest";

import { AppError } from "@/server/errors/app-error";
import { hasPermission, requirePermission, requireTenantScopedPermission, type Permission } from "@/server/authorization/permissions";

describe("permissions", () => {
  const granted = new Set<Permission>(["tenant.view"]);

  it("allows an explicitly granted capability", () => {
    expect(hasPermission(granted, "tenant.view")).toBe(true);
    expect(() => requirePermission(granted, "tenant.view")).not.toThrow();
  });

  it("denies a missing capability", () => {
    expect(() => requirePermission(granted, "roles.manage")).toThrow(AppError);
  });

  it("denies the same nominal permission outside its tenant", () => {
    const admin = { tenantId: "tenant-a", permissions: new Set<string>(["users.update"]) };
    expect(() => requireTenantScopedPermission(admin, "tenant-b", "users.update")).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });
});
