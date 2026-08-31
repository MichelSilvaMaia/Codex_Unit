import { redirect } from "next/navigation";
import { getActiveTenantContext } from "./active-tenant";

export async function requireActiveTenantForPage() {
  try {
    return await getActiveTenantContext();
  } catch {
    redirect("/select-tenant");
  }
}
