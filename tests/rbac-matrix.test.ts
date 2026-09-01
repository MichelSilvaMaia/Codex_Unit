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

  it("allows tenant admin all phase 3 capabilities", () => {
    const granted = new Set<string>(INITIAL_ROLE_MATRIX["tenant-admin"]);
    for (const permission of ["units.disable", "customers.disable", "contracts.disable", "resources.disable", "resource_categories.manage"] as const) {
      expect(hasPermission(granted, permission)).toBe(true);
    }
  });

  it("allows manager and denies operator customer creation", () => {
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.manager), "customers.create")).toBe(true);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.manager), "customers.disable")).toBe(false);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.operator), "customers.create")).toBe(false);
  });

  it("assigns reservation permissions without granting operator confirmation", () => {
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.manager), "reservations.confirm")).toBe(true);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.supervisor), "reservations.update")).toBe(true);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.operator), "reservations.create")).toBe(true);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.operator), "reservations.confirm")).toBe(false);
    for (const permission of ["reservations.submit", "reservations.approve", "reservations.reject", "reservations.mark_urgent"] as const) {
      expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.manager), permission)).toBe(true);
    }
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.operator), "reservations.submit")).toBe(true);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.operator), "reservations.approve")).toBe(false);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.operator), "reservations.reject")).toBe(false);
    expect(hasPermission(new Set(INITIAL_ROLE_MATRIX.operator), "reservations.mark_urgent")).toBe(false);
  });
});
