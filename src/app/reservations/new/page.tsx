import { createReservationAction } from "@/app/reservation-actions";
import { AppHeader } from "@/components/app-header";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { getReservationFormOptions } from "@/server/reservations/reservation-service";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova reserva" };

export default async function NewReservationPage() {
  const context = await requireActiveTenantForPage();
  const options = await getReservationFormOptions(context);
  return <main className="min-h-screen bg-muted"><AppHeader tenantName={context.tenantName} permissions={context.permissions} /><section className="mx-auto grid max-w-5xl gap-6 px-5 py-8 sm:px-8"><header><p className="text-sm font-medium text-primary">Nova ocupação temporal</p><h1 className="mt-1 text-3xl font-bold">Criar reserva</h1><p className="mt-2 text-muted-foreground">Intervalo semiaberto: uma reserva pode começar exatamente quando outra termina.</p></header><ReservationForm action={createReservationAction} allowInitialStatus options={options} /></section></main>;
}
