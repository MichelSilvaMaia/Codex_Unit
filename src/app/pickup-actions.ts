"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { completePickup, inspectPickup, refusePickup, startPickup } from "@/server/pickups/pickup-service";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
const text = (f: FormData, n: string) => String(f.get(n) ?? "");
export async function startPickupAction(reservationId: string, form: FormData) { const pickup = await startPickup(await getActiveTenantContext(), reservationId, { recipientName: text(form,"recipientName"), recipientDocument: text(form,"recipientDocument"), recipientPhone: text(form,"recipientPhone"), vehiclePlate: text(form,"vehiclePlate"), notes: text(form,"notes") }); redirect(`/pickups/${pickup.id}`); }
export async function inspectPickupAction(id: string, itemIds: string[], form: FormData) { await inspectPickup(await getActiveTenantContext(), id, { items: itemIds.map(pickupItemId => ({ pickupItemId, condition: text(form,`condition-${pickupItemId}`), notes: text(form,`notes-${pickupItemId}`) })) }); revalidatePath(`/pickups/${id}`); }
export async function completePickupAction(id: string) { await completePickup(await getActiveTenantContext(), id); revalidatePath(`/pickups/${id}`); revalidatePath("/pickups"); }
export async function refusePickupAction(id: string, form: FormData) { await refusePickup(await getActiveTenantContext(), id, { reasonCode: text(form,"reasonCode"), notes: text(form,"notes") }); revalidatePath(`/pickups/${id}`); revalidatePath("/pickups"); }
