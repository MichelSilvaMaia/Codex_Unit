import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/authorization/permissions";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuários" };

export default async function UsersPage() {
  const context = await requireActiveTenantForPage();
  requirePermission(context.permissions, "users.view");
  const members = await prisma.tenantMembership.findMany({
    where: { tenantId: context.tenantId },
    select: { id: true, status: true, user: { select: { name: true, email: true, status: true } }, roles: { select: { role: { select: { name: true } } } } },
    orderBy: { user: { email: "asc" } },
  });
  return <main className="min-h-screen bg-muted"><AppHeader tenantName={context.tenantName} /><section className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><h1 className="font-[var(--font-heading)] text-3xl font-bold">Usuários</h1><div className="mt-8 overflow-hidden rounded-xl border bg-background"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-4">Usuário</th><th className="p-4">Membership</th><th className="p-4">Papéis</th></tr></thead><tbody>{members.map((member) => <tr className="border-t" key={member.id}><td className="p-4"><strong className="block">{member.user.name ?? "Sem nome"}</strong><span className="text-muted-foreground">{member.user.email}</span></td><td className="p-4">{member.status}</td><td className="p-4">{member.roles.map(({ role }) => role.name).join(", ") || "Sem papel"}</td></tr>)}</tbody></table></div></section></main>;
}
