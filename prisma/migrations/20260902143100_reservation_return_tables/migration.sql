CREATE TYPE "ReturnStatus" AS ENUM ('IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "ReturnPresence" AS ENUM ('PRESENT','NOT_PRESENT');
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD','DAMAGED','MISSING_COMPONENTS','DIRTY','UNUSABLE','OTHER');
CREATE TYPE "ReturnDisposition" AS ENUM ('AVAILABLE','MAINTENANCE','UNAVAILABLE');

CREATE TABLE "ReservationReturn" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "reservationId" UUID NOT NULL,
  "pickupId" UUID NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "processedByUserId" UUID NOT NULL,
  "returnedByName" TEXT,
  "returnedByDocument" TEXT,
  "returnedByPhone" TEXT,
  "vehiclePlate" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ReservationReturn_tenantId_id_key" ON "ReservationReturn"("tenantId","id");
CREATE INDEX "ReservationReturn_tenantId_reservationId_createdAt_idx" ON "ReservationReturn"("tenantId","reservationId","createdAt");
CREATE INDEX "ReservationReturn_tenantId_pickupId_status_idx" ON "ReservationReturn"("tenantId","pickupId","status");
CREATE UNIQUE INDEX "ReservationReturn_one_completed_per_pickup" ON "ReservationReturn"("tenantId","pickupId") WHERE "status"='COMPLETED';
CREATE UNIQUE INDEX "ReservationReturn_one_active_per_pickup" ON "ReservationReturn"("tenantId","pickupId") WHERE "status"='IN_PROGRESS';

CREATE TABLE "ReservationReturnItem" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "returnId" UUID NOT NULL,
  "reservationItemId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "presence" "ReturnPresence" NOT NULL DEFAULT 'PRESENT',
  "condition" "ReturnCondition",
  "disposition" "ReturnDisposition",
  "notes" TEXT,
  "inspectedAt" TIMESTAMPTZ(3),
  "inspectedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReservationReturnItem_inspection_consistency" CHECK (
    ("inspectedAt" IS NULL AND "condition" IS NULL AND "disposition" IS NULL) OR
    ("inspectedAt" IS NOT NULL AND "presence"='NOT_PRESENT' AND "condition" IS NULL AND "disposition" IS NULL) OR
    ("inspectedAt" IS NOT NULL AND "presence"='PRESENT' AND "condition" IS NOT NULL AND "disposition" IS NOT NULL AND
      (("condition"='GOOD' AND "disposition"='AVAILABLE') OR
       ("condition" IN ('DAMAGED','MISSING_COMPONENTS','DIRTY') AND "disposition"='MAINTENANCE') OR
       ("condition"='UNUSABLE' AND "disposition"='UNAVAILABLE') OR
       ("condition"='OTHER' AND "disposition" IN ('MAINTENANCE','UNAVAILABLE'))))
  )
);
CREATE UNIQUE INDEX "ReservationReturnItem_returnId_reservationItemId_key" ON "ReservationReturnItem"("returnId","reservationItemId");
CREATE UNIQUE INDEX "ReservationReturnItem_tenantId_id_key" ON "ReservationReturnItem"("tenantId","id");
CREATE INDEX "ReservationReturnItem_tenantId_returnId_idx" ON "ReservationReturnItem"("tenantId","returnId");
CREATE INDEX "ReservationReturnItem_tenantId_resourceId_idx" ON "ReservationReturnItem"("tenantId","resourceId");

CREATE TABLE "ReturnEvidence" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "returnId" UUID NOT NULL,
  "returnItemId" UUID,
  "type" "EvidenceType" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "uploadedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ReturnEvidence_storageKey_key" ON "ReturnEvidence"("storageKey");
CREATE INDEX "ReturnEvidence_tenantId_returnId_createdAt_idx" ON "ReturnEvidence"("tenantId","returnId","createdAt");

ALTER TABLE "ResourceCustodyEvent" ADD COLUMN "returnId" UUID;
ALTER TABLE "ReservationReturn" ADD CONSTRAINT "ReservationReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "ReservationReturn" ADD CONSTRAINT "ReservationReturn_tenantId_reservationId_fkey" FOREIGN KEY ("tenantId","reservationId") REFERENCES "Reservation"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "ReservationReturn" ADD CONSTRAINT "ReservationReturn_tenantId_pickupId_fkey" FOREIGN KEY ("tenantId","pickupId") REFERENCES "ReservationPickup"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "ReservationReturn" ADD CONSTRAINT "ReservationReturn_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "ReservationReturnItem" ADD CONSTRAINT "ReservationReturnItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "ReservationReturnItem" ADD CONSTRAINT "ReservationReturnItem_tenantId_returnId_fkey" FOREIGN KEY ("tenantId","returnId") REFERENCES "ReservationReturn"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "ReservationReturnItem" ADD CONSTRAINT "ReservationReturnItem_reservationItemId_fkey" FOREIGN KEY ("reservationItemId") REFERENCES "ReservationItem"("id") ON DELETE RESTRICT;
ALTER TABLE "ReservationReturnItem" ADD CONSTRAINT "ReservationReturnItem_tenantId_resourceId_fkey" FOREIGN KEY ("tenantId","resourceId") REFERENCES "Resource"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "ReservationReturnItem" ADD CONSTRAINT "ReservationReturnItem_inspectedByUserId_fkey" FOREIGN KEY ("inspectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_tenantId_returnId_fkey" FOREIGN KEY ("tenantId","returnId") REFERENCES "ReservationReturn"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_tenantId_returnItemId_fkey" FOREIGN KEY ("tenantId","returnItemId") REFERENCES "ReservationReturnItem"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "ResourceCustodyEvent" ADD CONSTRAINT "ResourceCustodyEvent_tenantId_returnId_fkey" FOREIGN KEY ("tenantId","returnId") REFERENCES "ReservationReturn"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "ResourceCustodyEvent" ADD CONSTRAINT "ResourceCustodyEvent_return_semantics" CHECK (("type"='RETURNED_TO_TENANT' AND "returnId" IS NOT NULL) OR ("type"<>'RETURNED_TO_TENANT' AND "returnId" IS NULL));

UPDATE "ResourceCategory" SET "code"='VEICULO', "name"='Veículos' WHERE "code"='CABINE';
UPDATE "Resource" SET "code"='VEH-001', "name"='Veículo Utilitário 001', "description"='Veículo demonstrativo para reservas e controle de custódia' WHERE "code"='CAB-001';
