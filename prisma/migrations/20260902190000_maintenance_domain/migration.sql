CREATE TYPE "MaintenanceSource" AS ENUM ('RETURN_INSPECTION', 'MANUAL', 'OPERATIONAL_INSPECTION', 'OTHER');
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'DIAGNOSING', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'RELEASED', 'CANCELLED');
CREATE TYPE "MaintenanceActivityType" AS ENUM ('INSPECTION', 'REPAIR', 'CLEANING', 'TEST', 'ADJUSTMENT', 'OTHER');
CREATE TYPE "MaintenanceEvidenceType" AS ENUM ('DAMAGE', 'DIAGNOSIS', 'REPAIR', 'TEST_RESULT', 'FINAL_CONDITION', 'OTHER');

CREATE TABLE "MaintenanceOrder" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "resourceId" UUID NOT NULL,
  "sourceType" "MaintenanceSource" NOT NULL, "sourceReturnId" UUID, "sourceReturnItemId" UUID,
  "code" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL', "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "openedByUserId" UUID NOT NULL,
  "diagnosedAt" TIMESTAMPTZ(3), "startedAt" TIMESTAMPTZ(3), "completedAt" TIMESTAMPTZ(3),
  "releasedAt" TIMESTAMPTZ(3), "releasedByUserId" UUID, "releaseNotes" TEXT, "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaintenanceDiagnosis" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "maintenanceOrderId" UUID NOT NULL,
  "description" TEXT NOT NULL, "diagnosedByUserId" UUID NOT NULL, "diagnosedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceDiagnosis_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaintenanceActivity" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "maintenanceOrderId" UUID NOT NULL,
  "type" "MaintenanceActivityType" NOT NULL, "description" TEXT NOT NULL, "performedByUserId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MaintenanceActivity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaintenanceEvidence" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "maintenanceOrderId" UUID NOT NULL, "activityId" UUID,
  "type" "MaintenanceEvidenceType" NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL, "checksum" TEXT NOT NULL, "uploadedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MaintenanceEvidence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaintenanceStatusHistory" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "maintenanceOrderId" UUID NOT NULL,
  "fromStatus" "MaintenanceStatus", "toStatus" "MaintenanceStatus" NOT NULL, "actorUserId" UUID NOT NULL,
  "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaintenanceOrder_tenantId_code_key" ON "MaintenanceOrder"("tenantId", "code");
CREATE UNIQUE INDEX "MaintenanceOrder_tenantId_id_key" ON "MaintenanceOrder"("tenantId", "id");
CREATE UNIQUE INDEX "MaintenanceOrder_one_active_per_resource" ON "MaintenanceOrder"("tenantId", "resourceId") WHERE "status" IN ('OPEN','DIAGNOSING','IN_PROGRESS','WAITING','COMPLETED');
CREATE INDEX "MaintenanceOrder_tenantId_status_openedAt_idx" ON "MaintenanceOrder"("tenantId", "status", "openedAt");
CREATE INDEX "MaintenanceOrder_tenantId_resourceId_idx" ON "MaintenanceOrder"("tenantId", "resourceId");
CREATE INDEX "MaintenanceOrder_tenantId_priority_idx" ON "MaintenanceOrder"("tenantId", "priority");
CREATE INDEX "MaintenanceOrder_tenantId_sourceReturnId_idx" ON "MaintenanceOrder"("tenantId", "sourceReturnId");
CREATE INDEX "MaintenanceOrder_tenantId_sourceReturnItemId_idx" ON "MaintenanceOrder"("tenantId", "sourceReturnItemId");
CREATE INDEX "MaintenanceDiagnosis_tenantId_maintenanceOrderId_diagnosedAt_idx" ON "MaintenanceDiagnosis"("tenantId", "maintenanceOrderId", "diagnosedAt");
CREATE UNIQUE INDEX "MaintenanceActivity_tenantId_id_key" ON "MaintenanceActivity"("tenantId", "id");
CREATE INDEX "MaintenanceActivity_tenantId_maintenanceOrderId_occurredAt_idx" ON "MaintenanceActivity"("tenantId", "maintenanceOrderId", "occurredAt");
CREATE UNIQUE INDEX "MaintenanceEvidence_storageKey_key" ON "MaintenanceEvidence"("storageKey");
CREATE INDEX "MaintenanceEvidence_tenantId_maintenanceOrderId_createdAt_idx" ON "MaintenanceEvidence"("tenantId", "maintenanceOrderId", "createdAt");
CREATE INDEX "MaintenanceStatusHistory_tenantId_maintenanceOrderId_createdAt_idx" ON "MaintenanceStatusHistory"("tenantId", "maintenanceOrderId", "createdAt");

ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_tenantId_resourceId_fkey" FOREIGN KEY ("tenantId","resourceId") REFERENCES "Resource"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_tenantId_sourceReturnId_fkey" FOREIGN KEY ("tenantId","sourceReturnId") REFERENCES "ReservationReturn"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_tenantId_sourceReturnItemId_fkey" FOREIGN KEY ("tenantId","sourceReturnItemId") REFERENCES "ReservationReturnItem"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceDiagnosis" ADD CONSTRAINT "MaintenanceDiagnosis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceDiagnosis" ADD CONSTRAINT "MaintenanceDiagnosis_tenantId_maintenanceOrderId_fkey" FOREIGN KEY ("tenantId","maintenanceOrderId") REFERENCES "MaintenanceOrder"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "MaintenanceDiagnosis" ADD CONSTRAINT "MaintenanceDiagnosis_diagnosedByUserId_fkey" FOREIGN KEY ("diagnosedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceActivity" ADD CONSTRAINT "MaintenanceActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceActivity" ADD CONSTRAINT "MaintenanceActivity_tenantId_maintenanceOrderId_fkey" FOREIGN KEY ("tenantId","maintenanceOrderId") REFERENCES "MaintenanceOrder"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "MaintenanceActivity" ADD CONSTRAINT "MaintenanceActivity_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceEvidence" ADD CONSTRAINT "MaintenanceEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceEvidence" ADD CONSTRAINT "MaintenanceEvidence_tenantId_maintenanceOrderId_fkey" FOREIGN KEY ("tenantId","maintenanceOrderId") REFERENCES "MaintenanceOrder"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "MaintenanceEvidence" ADD CONSTRAINT "MaintenanceEvidence_tenantId_activityId_fkey" FOREIGN KEY ("tenantId","activityId") REFERENCES "MaintenanceActivity"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "MaintenanceEvidence" ADD CONSTRAINT "MaintenanceEvidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceStatusHistory" ADD CONSTRAINT "MaintenanceStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "MaintenanceStatusHistory" ADD CONSTRAINT "MaintenanceStatusHistory_tenantId_maintenanceOrderId_fkey" FOREIGN KEY ("tenantId","maintenanceOrderId") REFERENCES "MaintenanceOrder"("tenantId","id") ON DELETE CASCADE;
ALTER TABLE "MaintenanceStatusHistory" ADD CONSTRAINT "MaintenanceStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
