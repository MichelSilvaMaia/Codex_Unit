import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-background p-7 shadow-sm sm:p-9">
        <BrandMark />
        <h1 className="mt-10 font-[var(--font-heading)] text-3xl font-bold">Acesso em preparação</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          A fundação do Auth.js está ativa. O método de autenticação e o fluxo de recuperação serão adicionados na fase dedicada sem credenciais de demonstração inseguras.
        </p>
        <Button className="mt-8 w-full" disabled>Entrar</Button>
        <Link className="mt-5 block text-center text-sm text-primary underline-offset-4 hover:underline" href="/">Voltar ao início</Link>
      </section>
    </main>
  );
}
