ALTER TABLE "MaintenanceOrder" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ClientOperation" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "clientOperationId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "operationType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" UUID NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "resultReference" UUID,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientOperation_tenantId_clientOperationId_key" ON "ClientOperation"("tenantId", "clientOperationId");
CREATE INDEX "ClientOperation_tenantId_aggregateId_processedAt_idx" ON "ClientOperation"("tenantId", "aggregateId", "processedAt");
ALTER TABLE "ClientOperation" ADD CONSTRAINT "ClientOperation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "ClientOperation" ADD CONSTRAINT "ClientOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;

-- Existing online mutations also advance the aggregate version. This avoids a
-- queued operation overwriting a newer online diagnosis, activity or transition.
CREATE FUNCTION maintenance_bump_version() RETURNS trigger AS $$
BEGIN
  NEW."version" := OLD."version" + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER maintenance_order_bump_version BEFORE UPDATE ON "MaintenanceOrder"
FOR EACH ROW EXECUTE FUNCTION maintenance_bump_version();

CREATE FUNCTION maintenance_child_bump_version() RETURNS trigger AS $$
BEGIN
  UPDATE "MaintenanceOrder" SET "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."maintenanceOrderId" AND "tenantId" = NEW."tenantId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER maintenance_diagnosis_bump_version AFTER INSERT ON "MaintenanceDiagnosis"
FOR EACH ROW EXECUTE FUNCTION maintenance_child_bump_version();
CREATE TRIGGER maintenance_activity_bump_version AFTER INSERT ON "MaintenanceActivity"
FOR EACH ROW EXECUTE FUNCTION maintenance_child_bump_version();
CREATE TRIGGER maintenance_evidence_bump_version AFTER INSERT ON "MaintenanceEvidence"
FOR EACH ROW EXECUTE FUNCTION maintenance_child_bump_version();
