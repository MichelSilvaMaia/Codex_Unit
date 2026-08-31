import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Papéis e permissões" };

export default async function RolesPage() {
  const context = await requireActiveTenantForPage();
  requirePermission(context.permissions, "roles.view");
  const roles = await prisma.role.findMany({ where: { tenantId: context.tenantId }, select: { id: true, name: true, description: true, permissions: { select: { permission: { select: { code: true } } } } }, orderBy: { name: "asc" } });
  return <main className="min-h-screen bg-muted"><AppHeader tenantName={context.tenantName} /><section className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><h1 className="font-[var(--font-heading)] text-3xl font-bold">Papéis e permissões</h1><div className="mt-8 grid gap-4 md:grid-cols-2">{roles.map((role) => <article className="rounded-xl border bg-background p-5" key={role.id}><h2 className="font-semibold">{role.name}</h2><p className="mt-2 text-sm text-muted-foreground">{role.description ?? "Papel do sistema"}</p><div className="mt-4 flex flex-wrap gap-2">{role.permissions.map(({ permission }) => <code className="rounded bg-muted px-2 py-1 text-xs" key={permission.code}>{permission.code}</code>)}</div></article>)}</div></section></main>;
}
