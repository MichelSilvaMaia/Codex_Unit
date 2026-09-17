CREATE TABLE "OfflineAttachmentReceipt" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "attachmentId" UUID NOT NULL,
  "clientOperationId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "aggregateId" UUID NOT NULL,
  "checksum" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "evidenceType" "MaintenanceEvidenceType" NOT NULL,
  "status" TEXT NOT NULL,
  "evidenceId" UUID,
  "storageKey" TEXT NOT NULL,
  "claimedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMPTZ(3),
  CONSTRAINT "OfflineAttachmentReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OfflineAttachmentReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineAttachmentReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineAttachmentReceipt_status_check" CHECK ("status" IN ('CLAIMED','CONFIRMED'))
);
CREATE UNIQUE INDEX "OfflineAttachmentReceipt_tenantId_attachmentId_key" ON "OfflineAttachmentReceipt"("tenantId", "attachmentId");
CREATE INDEX "OfflineAttachmentReceipt_tenantId_aggregateId_idx" ON "OfflineAttachmentReceipt"("tenantId", "aggregateId");
