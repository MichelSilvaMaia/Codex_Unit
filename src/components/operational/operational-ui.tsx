import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const textareaClass = "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Field({ label, name, children, required }: { label: string; name: string; children?: ReactNode; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-medium" htmlFor={name}><span>{label}{required && <span aria-hidden="true"> *</span>}</span>{children ?? <Input id={name} name={name} required={required} />}</label>;
}

export function SearchFilters({ statusOptions }: { statusOptions: readonly string[] }) {
  return <form className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-[1fr_12rem_auto]" method="get"><Field label="Buscar" name="search"><Input id="search" name="search" placeholder="Nome ou código" /></Field><Field label="Status" name="status"><select className={selectClass} id="status" name="status"><option value="">Todos</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field><Button className="self-end" type="submit">Filtrar</Button></form>;
}

export function EmptyState({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">{children}</div>; }

export function Pager({ page, pageSize, total, pathname }: { page: number; pageSize: number; total: number; pathname: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label="Paginação" className="flex items-center justify-between text-sm text-muted-foreground"><span>{total} registro(s) · página {page} de {pages}</span><div className="flex gap-2">{page > 1 && <Link className="rounded-lg border bg-background px-3 py-2" href={`${pathname}?page=${page - 1}`}>Anterior</Link>}{page < pages && <Link className="rounded-lg border bg-background px-3 py-2" href={`${pathname}?page=${page + 1}`}>Próxima</Link>}</div></nav>;
}

export function StatusBadge({ children }: { children: ReactNode }) { return <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{children}</span>; }

export function FormCard({ title, children }: { title: string; children: ReactNode }) { return <details className="rounded-xl border bg-background p-5"><summary className="cursor-pointer font-semibold">{title}</summary><div className="mt-5">{children}</div></details>; }
