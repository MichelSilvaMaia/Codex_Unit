CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "ReservationStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "Tenant" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE TABLE "Reservation" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "contractId" UUID,
  "unitId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "endAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" UUID NOT NULL,
  "cancelledAt" TIMESTAMPTZ(3),
  "cancelledByUserId" UUID,
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Reservation_valid_period_check" CHECK ("endAt" > "startAt")
);

CREATE TABLE "ReservationItem" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "reservationId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "endAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "ReservationStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationItem_valid_period_check" CHECK ("endAt" > "startAt")
);

CREATE TABLE "ReservationStatusHistory" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "reservationId" UUID NOT NULL,
  "fromStatus" "ReservationStatus",
  "toStatus" "ReservationStatus" NOT NULL,
  "actorUserId" UUID NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Reservation_tenantId_code_key" ON "Reservation"("tenantId", "code");
CREATE UNIQUE INDEX "Reservation_tenantId_id_key" ON "Reservation"("tenantId", "id");
CREATE INDEX "Reservation_tenantId_status_idx" ON "Reservation"("tenantId", "status");
CREATE INDEX "Reservation_tenantId_startAt_idx" ON "Reservation"("tenantId", "startAt");
CREATE INDEX "Reservation_tenantId_endAt_idx" ON "Reservation"("tenantId", "endAt");
CREATE INDEX "Reservation_tenantId_customerId_idx" ON "Reservation"("tenantId", "customerId");
CREATE INDEX "Reservation_tenantId_contractId_idx" ON "Reservation"("tenantId", "contractId");
CREATE INDEX "Reservation_tenantId_unitId_idx" ON "Reservation"("tenantId", "unitId");
CREATE UNIQUE INDEX "ReservationItem_reservationId_resourceId_key" ON "ReservationItem"("reservationId", "resourceId");
CREATE INDEX "ReservationItem_tenantId_reservationId_idx" ON "ReservationItem"("tenantId", "reservationId");
CREATE INDEX "ReservationItem_tenantId_resourceId_startAt_endAt_idx" ON "ReservationItem"("tenantId", "resourceId", "startAt", "endAt");
CREATE INDEX "ReservationStatusHistory_tenantId_reservationId_createdAt_idx" ON "ReservationStatusHistory"("tenantId", "reservationId", "createdAt");
CREATE INDEX "ReservationStatusHistory_actorUserId_createdAt_idx" ON "ReservationStatusHistory"("actorUserId", "createdAt");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tenantId_contractId_fkey" FOREIGN KEY ("tenantId", "contractId") REFERENCES "Contract"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tenantId_unitId_fkey" FOREIGN KEY ("tenantId", "unitId") REFERENCES "Unit"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_tenantId_reservationId_fkey" FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_tenantId_resourceId_fkey" FOREIGN KEY ("tenantId", "resourceId") REFERENCES "Resource"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_tenantId_reservationId_fkey" FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not represent PostgreSQL exclusion constraints. This is the final
-- database-level guard against concurrent overlapping reservations.
ALTER TABLE "ReservationItem"
  ADD CONSTRAINT "ReservationItem_no_blocking_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
