import { ShieldCheck, Users, Building2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Área da empresa" };

export default async function DashboardPage() {
  const context = await requireActiveTenantForPage();
  const cards = [
    { icon: Building2, title: "Tenant validado", text: context.tenantName },
    { icon: ShieldCheck, title: "Permissões ativas", text: `${context.permissions.size} capacidades concedidas` },
    { icon: Users, title: "Identidade", text: context.user.email },
  ];
  return (
    <main className="min-h-screen bg-muted">
      <AppHeader tenantName={context.tenantName} />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Ambiente seguro</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold">Olá, {context.user.name ?? context.user.email}</h1>
        <p className="mt-4 text-muted-foreground">A identidade, a empresa ativa e as permissões foram revalidadas no servidor.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">{cards.map(({ icon: Icon, title, text }) => <article className="rounded-xl border bg-background p-5" key={title}><Icon className="size-5 text-primary" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>)}</div>
      </section>
    </main>
  );
}
