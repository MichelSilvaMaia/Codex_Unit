import { requestPickupOtpAction, verifyPickupOtpAction } from "@/app/acceptance-actions";
import { completePickupAction, inspectPickupAction, refusePickupAction } from "@/app/pickup-actions";
import { AppHeader } from "@/components/app-header";
import { selectClass, textareaClass } from "@/components/operational/operational-ui";
import { SignaturePad } from "@/components/pickups/signature-pad";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/server/authorization/permissions";
import { getPickup } from "@/server/pickups/pickup-service";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";

export const dynamic = "force-dynamic";
const inputClass = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function PickupPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireActiveTenantForPage();
  const pickup = await getPickup(context, (await params).id);
  const itemIds = pickup.items.map((item) => item.id);
  const verified = pickup.acceptances.find((acceptance) => acceptance.status === "VERIFIED");
  const pendingChallenge = pickup.acceptances.flatMap((acceptance) => acceptance.challenges).find((challenge) => challenge.status === "PENDING");
  return <main className="min-h-screen bg-muted"><AppHeader tenantName={context.tenantName} permissions={context.permissions}/><section className="mx-auto grid max-w-4xl gap-5 px-5 py-8">
    <header><p className="text-sm text-primary">{pickup.reservation.code}</p><h1 className="text-3xl font-bold">Conferência de retirada</h1><p>{pickup.recipientName} · {pickup.status}</p></header>
    <form action={inspectPickupAction.bind(null,pickup.id,itemIds)} className="grid gap-3">{pickup.items.map((item)=><article className="grid gap-3 rounded-xl border bg-background p-4" key={item.id}><strong>{item.resource.code} · {item.resource.name}</strong><select className={selectClass} defaultValue={item.condition} name={`condition-${item.id}`}><option>OK</option><option>DAMAGED</option><option>DIVERGENT</option><option>OTHER</option></select><textarea className={textareaClass} defaultValue={item.notes??""} name={`notes-${item.id}`} placeholder="Observação obrigatória para irregularidade"/></article>)}{pickup.status==="IN_PROGRESS"&&hasPermission(context.permissions,"pickups.inspect")&&<Button>Salvar conferência integral</Button>}</form>
    {pickup.status==="IN_PROGRESS"&&!verified&&<section className="grid gap-4"><header><h2 className="text-xl font-semibold">Aceite eletrônico</h2><p className="text-sm text-muted-foreground">Registre uma assinatura ou valide um OTP antes de concluir a retirada.</p></header>{hasPermission(context.permissions,"pickups.acceptance.capture_signature")&&<SignaturePad pickupId={pickup.id}/>} {hasPermission(context.permissions,"pickups.acceptance.request_otp")&&<form action={requestPickupOtpAction.bind(null,pickup.id)} className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2"><p className="font-semibold sm:col-span-2">Enviar código OTP</p><input className={inputClass} name="phone" defaultValue={pickup.recipientPhone??""} placeholder="Telefone com DDD"/><input className={inputClass} name="email" type="email" placeholder="E-mail alternativo"/><p className="text-xs text-muted-foreground sm:col-span-2">Prioridade automática: WhatsApp, SMS e e-mail.</p><Button className="sm:col-span-2">Solicitar código</Button></form>}{pendingChallenge&&hasPermission(context.permissions,"pickups.acceptance.verify")&&<form action={verifyPickupOtpAction.bind(null,pickup.id)} className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-[1fr_auto]"><input type="hidden" name="challengeId" value={pendingChallenge.id}/><input className={inputClass} name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="Código de 6 dígitos" required/><Button>Validar OTP</Button><p className="text-xs text-muted-foreground sm:col-span-2">Enviado por {pendingChallenge.channel} para {pendingChallenge.destinationMasked}.</p></form>}</section>}
    {verified&&<div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">Aceite verificado por {verified.method} em {verified.acceptedAt?.toLocaleString("pt-BR")}.</div>}
    {pickup.status==="IN_PROGRESS"&&<div className="grid gap-4 sm:grid-cols-2">{hasPermission(context.permissions,"pickups.complete")&&<form action={completePickupAction.bind(null,pickup.id)} className="rounded-xl border bg-background p-4"><p className="mb-3 text-sm">Confirma a saída integral de todos os recursos?</p><Button disabled={!verified}>Concluir retirada</Button></form>}{hasPermission(context.permissions,"pickups.refuse")&&<form action={refusePickupAction.bind(null,pickup.id)} className="grid gap-3 rounded-xl border bg-background p-4"><select className={selectClass} name="reasonCode" required><option value="">Motivo da recusa</option><option>DAMAGE</option><option>RESOURCE_MISMATCH</option><option>DOCUMENT_MISMATCH</option><option>RECIPIENT_MISMATCH</option><option>RESERVATION_INVALID</option><option>OTHER</option></select><textarea className={textareaClass} minLength={3} name="notes" required/><Button variant="outline">Recusar tentativa inteira</Button></form>}</div>}
  </section></main>;
}
