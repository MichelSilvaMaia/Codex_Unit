ALTER TABLE "Reservation"
  ADD COLUMN "isUrgent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "urgentReason" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMPTZ(3), ADD COLUMN "submittedByUserId" UUID,
  ADD COLUMN "approvedAt" TIMESTAMPTZ(3), ADD COLUMN "approvedByUserId" UUID,
  ADD COLUMN "rejectedAt" TIMESTAMPTZ(3), ADD COLUMN "rejectedByUserId" UUID,
  ADD COLUMN "rejectionReason" TEXT,
  ADD CONSTRAINT "Reservation_urgent_reason_check" CHECK (NOT "isUrgent" OR length(trim("urgentReason")) >= 3);
CREATE TYPE "ReservationDecision" AS ENUM ('APPROVED', 'REJECTED');
CREATE TABLE "ReservationApproval" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "reservationId" UUID NOT NULL, "decision" "ReservationDecision" NOT NULL, "decidedByUserId" UUID NOT NULL, "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ReservationApproval_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ReservationApproval_tenantId_reservationId_createdAt_idx" ON "ReservationApproval"("tenantId", "reservationId", "createdAt");
CREATE INDEX "ReservationApproval_decidedByUserId_createdAt_idx" ON "ReservationApproval"("decidedByUserId", "createdAt");
ALTER TABLE "ReservationApproval" ADD CONSTRAINT "ReservationApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationApproval" ADD CONSTRAINT "ReservationApproval_tenantId_reservationId_fkey" FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationApproval" ADD CONSTRAINT "ReservationApproval_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" DROP CONSTRAINT "ReservationItem_no_blocking_overlap";
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_no_blocking_overlap" EXCLUDE USING gist ("tenantId" WITH =, "resourceId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&) WHERE ("status" IN ('PENDING_APPROVAL', 'APPROVED', 'CONFIRMED'));
