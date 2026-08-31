"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-muted px-5"><section className="max-w-md rounded-xl border bg-background p-6 text-center"><h1 className="text-xl font-bold">Não foi possível carregar os dados</h1><p className="mt-2 text-sm text-muted-foreground">Tente novamente. Se o problema continuar, procure o administrador da empresa.</p><Button className="mt-5" onClick={reset}>Tentar novamente</Button></section></main>;
}
