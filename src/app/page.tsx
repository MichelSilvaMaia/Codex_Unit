import { ArrowRight, Building2, LockKeyhole, ScrollText } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

const foundations = [
  { icon: Building2, title: "Multiempresa desde a origem", text: "Usuários e empresas vinculados por memberships explícitas." },
  { icon: LockKeyhole, title: "Segurança no servidor", text: "O tenant ativo será sempre validado contra a identidade autenticada." },
  { icon: ScrollText, title: "Auditabilidade", text: "Estrutura inicial para registrar ações críticas sem armazenar segredos." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,var(--secondary),transparent_38%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <BrandMark />
        <Button asChild variant="outline"><Link href="/login">Acessar</Link></Button>
      </header>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:py-24">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex rounded-full border bg-background/80 px-3 py-1 text-sm text-muted-foreground">Fundação técnica do SaaS</p>
          <h1 className="font-[var(--font-heading)] text-4xl font-bold leading-tight tracking-[-0.04em] sm:text-6xl">
            Reservas organizadas sobre uma base segura.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            O Codex Unit está sendo preparado para operar múltiplas empresas com isolamento, autorização e rastreabilidade desde a primeira versão.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/login">Entrar na plataforma <ArrowRight className="ml-2 size-4" /></Link></Button>
            <Button asChild size="lg" variant="secondary"><Link href="/api/health">Verificar serviço</Link></Button>
          </div>
        </div>
        <div className="grid gap-4">
          {foundations.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border bg-background/85 p-6 shadow-sm backdrop-blur">
              <Icon className="mb-4 size-6 text-primary" aria-hidden />
              <h2 className="font-[var(--font-heading)] text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
