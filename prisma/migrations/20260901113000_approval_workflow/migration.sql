-- PENDING already meant "awaiting approval"; keep a single semantic state.
ALTER TYPE "ReservationStatus" RENAME VALUE 'PENDING' TO 'PENDING_APPROVAL';
ALTER TYPE "ReservationStatus" ADD VALUE 'APPROVED';
ALTER TYPE "ReservationStatus" ADD VALUE 'REJECTED';
