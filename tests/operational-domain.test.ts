import { describe, expect, it } from "vitest";
import { AppError } from "@/server/errors/app-error";
import { requireTenantScopedPermission } from "@/server/authorization/permissions";
import { assertTenantOwnership } from "@/server/operational/service-helpers";
import { contractSchema, customerSchema, isResourceOperationallyAvailable, normalizeDocument, resourceSchema, unitSchema } from "@/server/operational/validation";

describe("operational domain validation", () => {
  it("normalizes optional customer documents tenant-aware", () => {
    expect(normalizeDocument("12.345.678/0001-90")).toBe("12345678000190");
    expect(customerSchema.parse({ type: "COMPANY", legalName: "Cliente A", document: "12.345/0001" }).document).toBe("12.345/0001");
  });

  it("rejects an invalid contract period", () => {
    const result = contractSchema.safeParse({ customerId: crypto.randomUUID(), code: "CTR-1", title: "Contrato", startDate: "2026-09-10", endDate: "2026-09-09", unitIds: [] });
    expect(result.success).toBe(false);
  });

  it("keeps reservation out of resource state", () => {
    const base = { unitId: crypto.randomUUID(), categoryId: crypto.randomUUID(), code: "VEH-TEST", name: "Veículo de teste" };
    expect(resourceSchema.safeParse({ ...base, operationalStatus: "RESERVED" }).success).toBe(false);
    expect(isResourceOperationallyAvailable("ACTIVE", "AVAILABLE")).toBe(true);
    expect(isResourceOperationallyAvailable("INACTIVE", "AVAILABLE")).toBe(false);
    expect(isResourceOperationallyAvailable("ACTIVE", "MAINTENANCE")).toBe(false);
  });

  it("validates unit codes and controlled status", () => {
    expect(unitSchema.safeParse({ name: "Base Norte", code: "base norte" }).success).toBe(false);
    expect(unitSchema.parse({ name: "Base Norte", code: "bn-01" }).code).toBe("BN-01");
  });
});

describe("critical tenant isolation", () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  it.each(["Customer", "Contract", "Resource", "Unit", "ResourceCategory"])("returns not found for cross-tenant %s", () => {
    expect(() => assertTenantOwnership(tenantA, tenantB)).toThrowError(AppError);
    try { assertTenantOwnership(tenantA, tenantB); } catch (error) { expect(error).toMatchObject({ code: "NOT_FOUND" }); }
  });

  it("does not mutate a customer after a forged cross-tenant id", () => {
    const record = { tenantId: tenantB, legalName: "Original" };
    const update = () => { assertTenantOwnership(tenantA, record.tenantId); record.legalName = "Alterado"; };
    expect(update).toThrow();
    expect(record.legalName).toBe("Original");
  });

  it("does not let the correct permission escape its tenant", () => {
    expect(() => requireTenantScopedPermission({ tenantId: tenantA, permissions: new Set(["customers.update"]) }, tenantB, "customers.update")).toThrowError(AppError);
  });

  it("accepts relationships only inside the same tenant", () => {
    expect(() => assertTenantOwnership(tenantA, tenantA)).not.toThrow();
    expect(() => assertTenantOwnership(tenantA, tenantB)).toThrow();
  });
});
