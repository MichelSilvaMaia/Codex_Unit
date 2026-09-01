import { describe, expect, it } from "vitest";
import { requirePickupEligibility } from "@/server/pickups/pickup-policy";
import { inspectionSchema, refusalSchema } from "@/server/pickups/pickup-validation";
import { validateEvidence } from "@/server/pickups/evidence-service";
describe("pickup domain policy", () => {
  it.each(["DRAFT","PENDING_APPROVAL","REJECTED","CANCELLED"] as const)("denies %s reservations", status => expect(() => requirePickupEligibility(status,new Date("2020-01-01"))).toThrow());
  it("allows confirmed after the planned start", () => expect(() => requirePickupEligibility("CONFIRMED",new Date("2020-01-01"))).not.toThrow());
  it("denies early pickup", () => expect(() => requirePickupEligibility("CONFIRMED",new Date("2099-01-01"))).toThrow());
  it("requires notes for damage", () => expect(() => inspectionSchema.parse({items:[{pickupItemId:"00000000-0000-4000-8000-000000000001",condition:"DAMAGED"}]})).toThrow());
  it("requires refusal details", () => expect(() => refusalSchema.parse({reasonCode:"DAMAGE",notes:""})).toThrow());
  it("validates image magic bytes rather than trusting MIME", () => { expect(() => validateEvidence(new Uint8Array([1,2,3]),"image/png")).toThrow(); expect(() => validateEvidence(new Uint8Array([0x89,0x50,0x4e,0x47]),"image/png")).not.toThrow(); });
});
