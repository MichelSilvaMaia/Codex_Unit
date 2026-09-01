import { describe, expect, it } from "vitest";
import { rejectionSchema, reservationInputSchema, urgencySchema } from "@/server/reservations/reservation-validation";

const base = { customerId: "00000000-0000-4000-8000-000000000001", unitId: "00000000-0000-4000-8000-000000000002", title: "Reserva", startAtLocal: "2030-01-01T10:00", endAtLocal: "2030-01-01T11:00", resourceIds: ["00000000-0000-4000-8000-000000000003"], status: "DRAFT" };
describe("approval and urgency validation", () => {
  it("requires an urgency reason", () => expect(() => reservationInputSchema.parse({ ...base, isUrgent: true })).toThrow());
  it("accepts a justified urgent reservation", () => expect(reservationInputSchema.parse({ ...base, isUrgent: true, urgentReason: "Atendimento emergencial" }).isUrgent).toBe(true));
  it("requires a rejection reason", () => expect(() => rejectionSchema.parse({ reason: "" })).toThrow());
  it("does not accept urgency without a reason", () => expect(() => urgencySchema.parse({ isUrgent: true, reason: "" })).toThrow());
});
