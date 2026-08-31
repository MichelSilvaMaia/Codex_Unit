"use server";

import { redirect } from "next/navigation";
import { selectActiveTenant } from "@/server/tenancy/active-tenant";

export async function selectTenantAction(formData: FormData) {
  await selectActiveTenant(String(formData.get("tenantId") ?? ""));
  redirect("/dashboard");
}
