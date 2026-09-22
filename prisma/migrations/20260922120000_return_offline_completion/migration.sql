ALTER TABLE "ReservationReturn" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "OfflineAttachmentReceipt" ADD COLUMN "returnItemId" UUID;

CREATE UNIQUE INDEX "ResourceCustodyEvent_one_return_per_resource"
ON "ResourceCustodyEvent" ("tenantId", "returnId", "resourceId")
WHERE "type" = 'RETURNED_TO_TENANT' AND "returnId" IS NOT NULL;
