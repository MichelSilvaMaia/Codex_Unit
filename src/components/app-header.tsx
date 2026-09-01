import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandMark } from "@/components/brand-mark";
import { hasPermission, type Permission } from "@/server/authorization/permissions";

export function AppHeader({ tenantName, permissions = new Set<string>() }: { tenantName: string; permissions?: ReadonlySet<string> }) {
  const operationalLinks: { href: string; label: string; permission: Permission }[] = [
    { href: "/units", label: "Unidades", permission: "units.view" },
    { href: "/customers", label: "Clientes", permission: "customers.view" },
    { href: "/contracts", label: "Contratos", permission: "contracts.view" },
    { href: "/resources", label: "Recursos", permission: "resources.view" },
    { href: "/reservations", label: "Reservas", permission: "reservations.view" },
  ];
  return (
    <header className="border-b bg-background px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div><BrandMark /><p className="mt-1 text-xs text-muted-foreground">{tenantName}</p></div>
        <nav aria-label="Navegação principal" className="order-3 flex w-full gap-4 overflow-x-auto pb-1 text-sm sm:order-none sm:w-auto">
          <Link href="/dashboard">Início</Link>
          {operationalLinks.filter((link) => hasPermission(permissions, link.permission)).map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
          {hasPermission(permissions, "users.view") && <Link href="/users">Usuários</Link>}
          {hasPermission(permissions, "roles.view") && <Link href="/roles">Papéis</Link>}
          <Link href="/account">Conta</Link>
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}
