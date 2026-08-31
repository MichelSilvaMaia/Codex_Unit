import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/brand-mark";
import { getEnabledOAuthProviders } from "@/server/auth/auth-options";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/select-tenant");
  const providers = getEnabledOAuthProviders();
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-background p-7 shadow-sm sm:p-9">
        <BrandMark />
        <h1 className="mt-10 font-[var(--font-heading)] text-3xl font-bold">Acesse sua empresa</h1>
        <p className="mt-3 leading-7 text-muted-foreground">Use suas credenciais ou um provedor conectado pela administração.</p>
        <LoginForm {...providers} />
        <p className="mt-6 text-center text-sm text-muted-foreground">Esqueceu sua senha? Solicite um link ao administrador enquanto o envio de e-mail não está configurado.</p>
        <Link className="mt-4 block text-center text-sm text-primary underline-offset-4 hover:underline" href="/">Voltar ao início</Link>
      </section>
    </main>
  );
}
