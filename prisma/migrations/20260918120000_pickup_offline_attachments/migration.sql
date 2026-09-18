ALTER TABLE "OfflineAttachmentReceipt" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'MAINTENANCE_EVIDENCE';
ALTER TABLE "OfflineAttachmentReceipt" ADD COLUMN "pickupItemId" UUID;
ALTER TABLE "OfflineAttachmentReceipt" ADD COLUMN "expectedVersion" INTEGER;
ALTER TABLE "OfflineAttachmentReceipt" ALTER COLUMN "evidenceType" TYPE TEXT USING "evidenceType"::TEXT;

CREATE TABLE "OfflineSignatureReceipt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "attachmentId" UUID NOT NULL,
  "clientOperationId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "pickupId" UUID NOT NULL,
  "expectedVersion" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "termsHash" TEXT NOT NULL,
  "capturedAtDevice" TIMESTAMPTZ(3) NOT NULL,
  "status" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "acceptanceId" UUID,
  "claimedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMPTZ(3),
  CONSTRAINT "OfflineSignatureReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OfflineSignatureReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineSignatureReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineSignatureReceipt_pickup_fkey" FOREIGN KEY ("tenantId", "pickupId") REFERENCES "ReservationPickup"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OfflineSignatureReceipt_tenantId_attachmentId_key" ON "OfflineSignatureReceipt"("tenantId", "attachmentId");
CREATE UNIQUE INDEX "OfflineSignatureReceipt_tenantId_clientOperationId_key" ON "OfflineSignatureReceipt"("tenantId", "clientOperationId");
CREATE INDEX "OfflineSignatureReceipt_tenantId_pickupId_idx" ON "OfflineSignatureReceipt"("tenantId", "pickupId");
