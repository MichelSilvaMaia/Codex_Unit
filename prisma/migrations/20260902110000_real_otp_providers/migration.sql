ALTER TYPE "OtpDeliveryStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "OtpDeliveryStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "OtpDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "OtpDeliveryStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';
ALTER TYPE "OtpDeliveryStatus" ADD VALUE IF NOT EXISTS 'UNDELIVERED';
ALTER TYPE "OtpDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELAYED';

ALTER TABLE "OtpDeliveryAttempt"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "acceptedAt" TIMESTAMPTZ(3),
  ADD COLUMN "deliveredAt" TIMESTAMPTZ(3),
  ADD COLUMN "failedAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastEventAt" TIMESTAMPTZ(3);

UPDATE "OtpDeliveryAttempt"
SET "idempotencyKey" = 'legacy/' || "id"::text,
    "acceptedAt" = CASE WHEN "status" = 'SENT' THEN "sentAt" ELSE NULL END,
    "failedAt" = CASE WHEN "status" = 'FAILED' THEN "sentAt" ELSE NULL END;

ALTER TABLE "OtpDeliveryAttempt" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "OtpDeliveryAttempt_idempotencyKey_key" ON "OtpDeliveryAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "OtpDeliveryAttempt_provider_providerMessageId_key" ON "OtpDeliveryAttempt"("provider", "providerMessageId");

CREATE TABLE "OtpWebhookEvent" (
  "id" UUID PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OtpWebhookEvent_provider_eventId_key" ON "OtpWebhookEvent"("provider", "eventId");
