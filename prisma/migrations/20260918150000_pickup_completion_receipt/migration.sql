ALTER TABLE "ClientOperation" ADD COLUMN "resultVersion" INTEGER;
ALTER TABLE "ClientOperation" ADD COLUMN "resultPayload" JSONB;
CREATE UNIQUE INDEX "ResourceCustodyEvent_one_release_per_pickup_resource" ON "ResourceCustodyEvent"("tenantId", "pickupId", "resourceId") WHERE "type" = 'RELEASED_TO_RECIPIENT';
