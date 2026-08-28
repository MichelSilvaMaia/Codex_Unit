import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Área da empresa" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-muted">
      <header className="border-b bg-background px-5 py-5 sm:px-8"><BrandMark /></header>
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Área autenticada</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-bold">Fundação pronta para os próximos módulos</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">Nenhum dashboard operacional foi implementado nesta fase.</p>
      </section>
    </main>
  );
}
