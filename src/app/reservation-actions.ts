"use server";

import type { ReservationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveReservation, cancelReservation, createReservation, rejectReservation, reopenReservation, setReservationUrgency, submitReservationForApproval, transitionReservation, updateReservation } from "@/server/reservations/reservation-service";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";

const text = (form: FormData, name: string) => String(form.get(name) ?? "");
const optional = (form: FormData, name: string) => text(form, name).trim() || undefined;
function input(form: FormData) { return { customerId: text(form, "customerId"), contractId: optional(form, "contractId"), unitId: text(form, "unitId"), title: text(form, "title"), description: optional(form, "description"), startAtLocal: text(form, "startAtLocal"), endAtLocal: text(form, "endAtLocal"), resourceIds: form.getAll("resourceIds").map(String) }; }

export async function createReservationAction(form: FormData) {
  const reservation = await createReservation(await getActiveTenantContext(), { ...input(form), status: "DRAFT" });
  redirect(`/reservations/${reservation.id}`);
}

export async function updateReservationAction(id: string, form: FormData) { await updateReservation(await getActiveTenantContext(), id, input(form)); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
export async function transitionReservationAction(id: string, status: ReservationStatus) { await transitionReservation(await getActiveTenantContext(), id, status); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
export async function cancelReservationAction(id: string, form: FormData) { await cancelReservation(await getActiveTenantContext(), id, { reason: text(form, "reason") }); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
export async function submitReservationAction(id: string) { await submitReservationForApproval(await getActiveTenantContext(), id); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
export async function approveReservationAction(id: string) { await approveReservation(await getActiveTenantContext(), id); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
export async function rejectReservationAction(id: string, form: FormData) { await rejectReservation(await getActiveTenantContext(), id, { reason: text(form, "reason") }); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
export async function reopenReservationAction(id: string) { await reopenReservation(await getActiveTenantContext(), id); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
export async function setReservationUrgencyAction(id: string, urgent: boolean, form: FormData) { await setReservationUrgency(await getActiveTenantContext(), id, { isUrgent: urgent, reason: text(form, "reason") }); revalidatePath(`/reservations/${id}`); revalidatePath("/reservations"); }
