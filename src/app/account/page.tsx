import { AppHeader } from "@/components/app-header";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const context = await requireActiveTenantForPage();
  return <main className="min-h-screen bg-muted"><AppHeader tenantName={context.tenantName} /><section className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><h1 className="font-[var(--font-heading)] text-3xl font-bold">Minha conta</h1><dl className="mt-8 grid gap-4 rounded-xl border bg-background p-6"><div><dt className="text-sm text-muted-foreground">Nome</dt><dd className="mt-1 font-medium">{context.user.name ?? "Não informado"}</dd></div><div><dt className="text-sm text-muted-foreground">E-mail</dt><dd className="mt-1 font-medium">{context.user.email}</dd></div><div><dt className="text-sm text-muted-foreground">Empresa ativa</dt><dd className="mt-1 font-medium">{context.tenantName}</dd></div></dl></section></main>;
}
