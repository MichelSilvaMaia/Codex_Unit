import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  captureDrawnSignature,
  requestAcceptanceOtp,
  verifyAcceptanceOtp,
} from "@/server/acceptance/acceptance-service";
import type { OtpDeliveryProvider } from "@/server/acceptance/otp-provider";
import { processResendWebhook, processZenviaWebhook } from "@/server/acceptance/delivery-webhooks";
import {
  completePickup,
  inspectPickup,
  refusePickup,
  startPickup,
} from "@/server/pickups/pickup-service";
import {
  approveReservation,
  createReservation,
  submitReservationForApproval,
  transitionReservation,
} from "@/server/reservations/reservation-service";
import type { StorageProvider, StoredObject } from "@/server/storage/storage-provider";

const suite = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;

class CapturingProvider implements OtpDeliveryProvider {
  readonly name = "integration-test";
  readonly channel = "WHATSAPP" as const;
  code = "";

  async send(input: { code: string }) {
    this.code = input.code;
    return { accepted: true, retryable: false, providerMessageId: "integration-test" };
  }
}

class MemoryStorage implements StorageProvider {
  private readonly objects = new Map<string, Uint8Array>();

  async put(key: string, content: Uint8Array, contentType: string): Promise<StoredObject> {
    this.objects.set(key, content);
    return { key, contentType, size: content.length };
  }

  async get(key: string) {
    const content = this.objects.get(key);
    if (!content) throw new Error("not found");
    return content;
  }

  async getSignedReadUrl(key: string) {
    return `memory://${key}`;
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

suite("Phase 7 acceptance security on PostgreSQL", () => {
  const reservations: string[] = [];
  let resourceId = "";
  let sequence = 0;

  beforeAll(() => {
    process.env.OTP_HMAC_SECRET = "integration-test-secret-with-more-than-32-characters";
  });

  afterEach(async () => {
    for (const reservationId of reservations.splice(0)) {
      await prisma.resourceCustodyEvent.deleteMany({ where: { reservationId } });
      await prisma.reservationPickup.deleteMany({ where: { reservationId } });
      await prisma.reservation.deleteMany({ where: { id: reservationId } });
    }
    if (resourceId) {
      await prisma.resource.update({ where: { id: resourceId }, data: { operationalStatus: "AVAILABLE" } });
    }
  });

  afterAll(async () => {
    delete process.env.OTP_HMAC_SECRET;
    await prisma.$disconnect();
  });

  async function fixture() {
    sequence += 1;
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "empresa-demonstracao" } });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.test" },
    });
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { tenantId_normalizedDocument: { tenantId: tenant.id, normalizedDocument: "DEMO0001" } },
    });
    const unit = await prisma.unit.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: tenant.id, code: "BASE-SP" } },
    });
    const resource = await prisma.resource.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: tenant.id, code: "CAB-001" } },
    });
    resourceId = resource.id;
    const context = {
      tenantId: tenant.id,
      user: { id: user.id },
      permissions: new Set<string>([
        "reservations.create",
        "reservations.submit",
        "reservations.approve",
        "reservations.confirm",
        "pickups.start",
        "pickups.inspect",
        "pickups.refuse",
        "pickups.complete",
        "pickups.acceptance.request_otp",
        "pickups.acceptance.verify",
        "pickups.acceptance.capture_signature",
      ]),
    };
    const hour = 8 + sequence;
    const reservation = await createReservation(context, {
      customerId: customer.id,
      unitId: unit.id,
      title: `Aceite seguro ${sequence}`,
      startAtLocal: `2026-08-20T${String(hour).padStart(2, "0")}:00`,
      endAtLocal: `2026-08-20T${String(hour + 1).padStart(2, "0")}:00`,
      resourceIds: [resource.id],
      status: "DRAFT",
    });
    reservations.push(reservation.id);
    await submitReservationForApproval(context, reservation.id);
    await approveReservation(context, reservation.id);
    await transitionReservation(context, reservation.id, "CONFIRMED");
    const pickup = await startPickup(context, reservation.id, {
      recipientName: "Responsável pelo aceite",
      recipientPhone: "+5511999999999",
    });
    const items = await prisma.reservationPickupItem.findMany({ where: { pickupId: pickup.id } });
    await inspectPickup(context, pickup.id, {
      items: items.map((item) => ({ pickupItemId: item.id, condition: "OK" })),
    });
    return { context, pickup, reservation };
  }

  it("rejects replay after a successful OTP verification", async () => {
    const { context, pickup } = await fixture();
    const provider = new CapturingProvider();
    const issued = await requestAcceptanceOtp(context, pickup.id, {}, [provider]);

    await verifyAcceptanceOtp(context, issued.challenge.id, provider.code);
    await expect(verifyAcceptanceOtp(context, issued.challenge.id, provider.code)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("allows exactly one winner for simultaneous validation of the same OTP", async () => {
    const { context, pickup } = await fixture();
    const provider = new CapturingProvider();
    const issued = await requestAcceptanceOtp(context, pickup.id, {}, [provider]);

    const results = await Promise.allSettled([
      verifyAcceptanceOtp(context, issued.challenge.id, provider.code),
      verifyAcceptanceOtp(context, issued.challenge.id, provider.code),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: pickup.id, status: "VERIFIED" } })).toBe(1);
  });

  it("allows only one final acceptance when signature and OTP race", async () => {
    const { context, pickup } = await fixture();
    const provider = new CapturingProvider();
    const issued = await requestAcceptanceOtp(context, pickup.id, {}, [provider]);
    const png = new Uint8Array(128);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const results = await Promise.allSettled([
      verifyAcceptanceOtp(context, issued.challenge.id, provider.code),
      captureDrawnSignature(context, pickup.id, { content: png, width: 300, height: 120 }, new MemoryStorage()),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: pickup.id, status: "VERIFIED" } })).toBe(1);
  });

  it("never reuses acceptance from a refused pickup in a later attempt", async () => {
    const { context, pickup, reservation } = await fixture();
    const provider = new CapturingProvider();
    const issued = await requestAcceptanceOtp(context, pickup.id, {}, [provider]);
    await verifyAcceptanceOtp(context, issued.challenge.id, provider.code);
    await refusePickup(context, pickup.id, { reasonCode: "DOCUMENT_MISMATCH", notes: "Nova tentativa exigida" });

    const nextPickup = await startPickup(context, reservation.id, {
      recipientName: "Responsável pela nova tentativa",
      recipientPhone: "+5511988888888",
    });
    const items = await prisma.reservationPickupItem.findMany({ where: { pickupId: nextPickup.id } });
    await inspectPickup(context, nextPickup.id, {
      items: items.map((item) => ({ pickupItemId: item.id, condition: "OK" })),
    });

    await expect(completePickup(context, nextPickup.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.pickupAcceptance.count({ where: { pickupId: nextPickup.id, status: "VERIFIED" } })).toBe(0);
  });

  it("persists invalid attempts and blocks the challenge at its limit", async () => {
    const { context, pickup } = await fixture();
    const provider = new CapturingProvider();
    const issued = await requestAcceptanceOtp(context, pickup.id, {}, [provider]);
    const invalidCode = provider.code === "000000" ? "999999" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(verifyAcceptanceOtp(context, issued.challenge.id, invalidCode)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    const challenge = await prisma.pickupOtpChallenge.findUniqueOrThrow({ where: { id: issued.challenge.id } });
    expect(challenge.attempts).toBe(5);
    expect(challenge.status).toBe("BLOCKED");
    await expect(verifyAcceptanceOtp(context, issued.challenge.id, provider.code)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("falls back sequentially from WhatsApp failure to SMS success", async () => {
    const { context, pickup } = await fixture();
    const calls: string[] = [];
    const providers: OtpDeliveryProvider[] = [
      { name: "zenvia", channel: "WHATSAPP", async send() { calls.push("WHATSAPP"); return { accepted: false, retryable: true, fallbackAllowed: true, errorCode: "TIMEOUT" }; } },
      { name: "zenvia", channel: "SMS", async send() { calls.push("SMS"); return { accepted: true, retryable: false, providerMessageId: "sms-fallback" }; } },
    ];
    const issued = await requestAcceptanceOtp(context, pickup.id, {}, providers);
    expect(issued.channel).toBe("SMS");
    expect(calls).toEqual(["WHATSAPP", "SMS"]);
    expect(await prisma.otpDeliveryAttempt.findMany({ where: { challengeId: issued.challenge.id }, orderBy: { createdAt: "asc" }, select: { channel: true, status: true } })).toEqual([{ channel: "WHATSAPP", status: "FAILED" }, { channel: "SMS", status: "ACCEPTED" }]);
  });

  it("falls back through WhatsApp and SMS to Resend email", async () => {
    const { context, pickup } = await fixture();
    const calls: string[] = [];
    const failure = (channel: "WHATSAPP" | "SMS"): OtpDeliveryProvider => ({ name: "zenvia", channel, async send() { calls.push(channel); return { accepted: false, retryable: true, fallbackAllowed: true, errorCode: "HTTP_503" }; } });
    const email: OtpDeliveryProvider = { name: "resend", channel: "EMAIL", async send() { calls.push("EMAIL"); return { accepted: true, retryable: false, providerMessageId: "email-fallback" }; } };
    const issued = await requestAcceptanceOtp(context, pickup.id, { email: "recipient@example.com" }, [failure("WHATSAPP"), failure("SMS"), email]);
    expect(issued.channel).toBe("EMAIL");
    expect(calls).toEqual(["WHATSAPP", "SMS", "EMAIL"]);
  });

  it("authenticates and idempotently applies Zenvia delivery webhooks", async () => {
    const { context, pickup } = await fixture();
    let code = "";
    const provider: OtpDeliveryProvider = { name: "zenvia", channel: "WHATSAPP", async send(input) { code = input.code; return { accepted: true, retryable: false, providerMessageId: "zenvia-webhook-message" }; } };
    const issued = await requestAcceptanceOtp(context, pickup.id, {}, [provider]);
    expect(code).toHaveLength(6);
    const raw = JSON.stringify({ id: `zenvia-event-${pickup.id}`, type: "MESSAGE_STATUS", timestamp: new Date().toISOString(), status: "DELIVERED", messageId: "zenvia-webhook-message" });
    await expect(processZenviaWebhook(raw, "wrong", "expected")).rejects.toThrow("INVALID_WEBHOOK_AUTH");
    expect(await processZenviaWebhook(raw, "expected", "expected")).toMatchObject({ matched: true, duplicate: false });
    expect(await processZenviaWebhook(raw, "expected", "expected")).toMatchObject({ duplicate: true });
    expect((await prisma.otpDeliveryAttempt.findFirstOrThrow({ where: { challengeId: issued.challenge.id } })).status).toBe("DELIVERED");
  });

  it("verifies Resend Svix signatures and correlates email delivery", async () => {
    const { context, pickup } = await fixture();
    const provider: OtpDeliveryProvider = { name: "resend", channel: "EMAIL", async send() { return { accepted: true, retryable: false, providerMessageId: "resend-email-1" }; } };
    await requestAcceptanceOtp(context, pickup.id, { email: "recipient@example.com" }, [provider]);
    const secret = `whsec_${Buffer.from("resend-webhook-test-secret").toString("base64")}`;
    const event = { type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "resend-email-1" } };
    const raw = JSON.stringify(event), id = `resend-event-${pickup.id}`, timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${timestamp}.${raw}`).digest("base64");
    const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` });
    expect(await processResendWebhook(raw, headers, secret)).toMatchObject({ matched: true, duplicate: false });
    await expect(processResendWebhook(raw, new Headers(), secret)).rejects.toThrow("INVALID_WEBHOOK_AUTH");
  });
});
