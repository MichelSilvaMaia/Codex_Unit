export const PICKUP_TERMS_VERSION = "pickup-acceptance-v1";

export function pickupTermsSnapshot(input: { reservationCode: string; recipientName: string; resources: string[]; conditions: string[] }) {
  return [`Termo ${PICKUP_TERMS_VERSION}`, `Reserva: ${input.reservationCode}`, `Destinatário: ${input.recipientName}`, `Recursos: ${input.resources.join(", ")}`, `Condições: ${input.conditions.join(", ")}`, "Confirmo o recebimento e a responsabilidade pelos recursos relacionados."].join("\n");
}
