import { describe, expect, it } from "vitest";
import { hasPermission, INITIAL_ROLE_MATRIX } from "@/server/authorization/permissions";

describe("initial RBAC matrix", () => {
  it("allows tenant admin to manage users and roles", () => {
    const granted = new Set<string>(INITIAL_ROLE_MATRIX["tenant-admin"]);
    expect(hasPermission(granted, "users.view")).toBe(true);
    expect(hasPermission(granted, "users.create")).toBe(true);
    expect(hasPermission(granted, "users.update")).toBe(true);
    expect(hasPermission(granted, "roles.manage")).toBe(true);
  });

  it("allows manager to view users but denies role management", () => {
    const granted = new Set<string>(INITIAL_ROLE_MATRIX.manager);
    expect(hasPermission(granted, "users.view")).toBe(true);
    expect(hasPermission(granted, "roles.manage")).toBe(false);
  });

  it("denies user administration to operator", () => {
    const granted = new Set<string>(INITIAL_ROLE_MATRIX.operator);
    expect(hasPermission(granted, "users.view")).toBe(false);
    expect(hasPermission(granted, "users.update")).toBe(false);
  });
});
