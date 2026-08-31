import { Building2 } from "lucide-react";

import { selectTenantAction } from "./actions";
import { AutoSelectTenant } from "@/components/tenancy/auto-select-tenant";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/server/auth/session";
import { listAvailableTenants } from "@/server/tenancy/active-tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Selecionar empresa" };

export default async function SelectTenantPage() {
  const user = await requireAuth();
  const memberships = await listAvailableTenants(user.id);
  if (memberships.length === 1) return <main className="grid min-h-screen place-items-center"><AutoSelectTenant tenantId={memberships[0].tenant.id} /></main>;
  return (
    <main className="min-h-screen bg-muted px-5 py-12">
      <section className="mx-auto max-w-2xl rounded-2xl border bg-background p-7 shadow-sm sm:p-9">
        <BrandMark />
        <h1 className="mt-10 font-[var(--font-heading)] text-3xl font-bold">Escolha uma empresa</h1>
        <p className="mt-3 text-muted-foreground">Somente vínculos ativos com empresas ativas aparecem aqui.</p>
        {memberships.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed p-6 text-center text-muted-foreground">Sua conta ainda não possui uma empresa ativa. Solicite um convite ao administrador.</div>
        ) : (
          <div className="mt-8 grid gap-3">
            {memberships.map(({ tenant }) => (
              <form action={selectTenantAction} key={tenant.id}>
                <input name="tenantId" type="hidden" value={tenant.id} />
                <Button className="h-auto w-full justify-start gap-3 p-4 text-left" type="submit" variant="outline">
                  <Building2 className="size-5 text-primary" /><span><strong className="block">{tenant.tradeName}</strong><span className="font-normal text-muted-foreground">{tenant.slug}</span></span>
                </Button>
              </form>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
