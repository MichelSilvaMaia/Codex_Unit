import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Pager, StatusBadge, selectClass } from "@/components/operational/operational-ui";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/server/authorization/permissions";
import { listReservations } from "@/server/reservations/reservation-service";
import { formatInTimeZone } from "@/server/reservations/timezone";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reservas" };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await requireActiveTenantForPage();
  const query = await searchParams;
  const data = await listReservations(context, query);
  const zone = context.timeZone;
  return <main className="min-h-screen bg-muted"><AppHeader tenantName={context.tenantName} permissions={context.permissions} /><section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Agenda operacional</p><h1 className="mt-1 text-3xl font-bold">Reservas</h1><p className="mt-2 text-muted-foreground">Horários apresentados em {zone}.</p></div>{hasPermission(context.permissions, "reservations.create") && <Button asChild><Link href="/reservations/new"><Plus className="mr-2 size-4" />Nova reserva</Link></Button>}</header><form className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-5" method="get"><label className="grid gap-1 text-sm">Buscar<input className={selectClass} defaultValue={query.search} name="search" /></label><label className="grid gap-1 text-sm">Status<select className={selectClass} defaultValue={query.status} name="status"><option value="">Todos</option><option>DRAFT</option><option>PENDING</option><option>CONFIRMED</option><option>CANCELLED</option></select></label><label className="grid gap-1 text-sm">De<input className={selectClass} defaultValue={query.from} name="from" type="datetime-local" /></label><label className="grid gap-1 text-sm">Até<input className={selectClass} defaultValue={query.to} name="to" type="datetime-local" /></label><Button className="self-end" type="submit">Filtrar</Button></form><div className="grid gap-4">{data.items.length === 0 ? <div className="rounded-xl border border-dashed bg-background p-10 text-center text-muted-foreground">Nenhuma reserva encontrada para o período.</div> : data.items.map((item) => <Link className="grid gap-3 rounded-xl border bg-background p-5 transition hover:border-primary sm:grid-cols-[1fr_auto]" href={`/reservations/${item.id}`} key={item.id}><div><div className="flex flex-wrap items-center gap-2"><CalendarDays className="size-4 text-primary" /><strong>{item.code} · {item.title}</strong><StatusBadge>{item.status}</StatusBadge></div><p className="mt-2 text-sm text-muted-foreground">{item.customer.legalName} · {item.unit.name} · {item._count.items} recurso(s)</p></div><p className="text-sm font-medium sm:text-right">{formatInTimeZone(item.startAt, zone)}<br />{formatInTimeZone(item.endAt, zone)}</p></Link>)}</div><Pager page={data.page} pageSize={data.pageSize} pathname="/reservations" total={data.total} /></section></main>;
}
