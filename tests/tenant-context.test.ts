import { MembershipStatus, TenantStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { AppError } from "@/server/errors/app-error";
import { resolveTenantContext, type MembershipRecord } from "@/server/tenancy/tenant-context";

const membership: MembershipRecord = {
  id: "membership-a",
  userId: "user-a",
  tenantId: "tenant-a",
  status: MembershipStatus.ACTIVE,
  tenant: { slug: "tenant-a", status: TenantStatus.ACTIVE },
};

describe("resolveTenantContext", () => {
  it("resolves an active membership for the authenticated user", async () => {
    const context = await resolveTenantContext("user-a", "tenant-a", async () => membership);
    expect(context).toMatchObject({ userId: "user-a", tenantId: "tenant-a" });
  });

  it("does not allow a user to cross tenant boundaries", async () => {
    await expect(resolveTenantContext("user-a", "tenant-b", async () => null)).rejects.toBeInstanceOf(AppError);
  });

  it("rejects suspended memberships", async () => {
    const suspended = { ...membership, status: MembershipStatus.SUSPENDED };
    await expect(resolveTenantContext("user-a", "tenant-a", async () => suspended)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
