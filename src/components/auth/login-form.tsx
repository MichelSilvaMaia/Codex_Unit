"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ google, microsoft }: { google: boolean; microsoft: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
        callbackUrl: "/select-tenant",
      });
      if (!result?.ok) {
        setError("E-mail ou senha inválidos.");
        return;
      }
      router.push("/select-tenant");
      router.refresh();
    } catch {
      setError("Não foi possível concluir o login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">E-mail</label>
          <Input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">Senha</label>
          <Input autoComplete="current-password" id="password" maxLength={128} name="password" required type="password" />
        </div>
        {error && <p aria-live="polite" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={loading} type="submit">{loading ? "Entrando…" : "Entrar"}</Button>
      </form>

      {(google || microsoft) && <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>}
      {google && <Button className="w-full" onClick={() => signIn("google", { callbackUrl: "/select-tenant" })} type="button" variant="outline">Continuar com Google</Button>}
      {microsoft && <Button className="w-full" onClick={() => signIn("azure-ad", { callbackUrl: "/select-tenant" })} type="button" variant="outline">Continuar com Microsoft</Button>}
    </div>
  );
}
