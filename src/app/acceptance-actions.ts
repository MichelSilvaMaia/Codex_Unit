"use server";

import { revalidatePath } from "next/cache";
import {
  captureDrawnSignature,
  requestAcceptanceOtp,
  verifyAcceptanceOtp,
} from "@/server/acceptance/acceptance-service";
import { DevelopmentOtpProvider } from "@/server/acceptance/otp-provider";
import { AppError } from "@/server/errors/app-error";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function requestPickupOtpAction(pickupId: string, form: FormData) {
  await requestAcceptanceOtp(
    await getActiveTenantContext(),
    pickupId,
    { phone: text(form, "phone") || undefined, email: text(form, "email") || undefined },
    [
      new DevelopmentOtpProvider("WHATSAPP"),
      new DevelopmentOtpProvider("SMS"),
      new DevelopmentOtpProvider("EMAIL"),
    ],
  );
  revalidatePath(`/pickups/${pickupId}`);
}

export async function verifyPickupOtpAction(pickupId: string, form: FormData) {
  await verifyAcceptanceOtp(await getActiveTenantContext(), text(form, "challengeId"), text(form, "code"));
  revalidatePath(`/pickups/${pickupId}`);
}

export async function capturePickupSignatureAction(pickupId: string, form: FormData) {
  const encoded = text(form, "signature");
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(encoded);
  if (!match) throw new AppError("VALIDATION_ERROR", "Assinatura vazia ou inválida.");
  const content = Uint8Array.from(Buffer.from(match[1], "base64"));
  await captureDrawnSignature(await getActiveTenantContext(), pickupId, {
    content,
    width: Number(text(form, "width")),
    height: Number(text(form, "height")),
  });
  revalidatePath(`/pickups/${pickupId}`);
}
