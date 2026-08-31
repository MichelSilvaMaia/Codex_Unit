import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandMark } from "@/components/brand-mark";

export function AppHeader({ tenantName }: { tenantName: string }) {
  return (
    <header className="border-b bg-background px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div><BrandMark /><p className="mt-1 text-xs text-muted-foreground">{tenantName}</p></div>
        <nav className="hidden items-center gap-5 text-sm sm:flex">
          <Link href="/dashboard">Início</Link><Link href="/users">Usuários</Link><Link href="/roles">Papéis</Link><Link href="/account">Minha conta</Link>
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}
