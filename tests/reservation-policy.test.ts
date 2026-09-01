import { describe, expect, it } from "vitest";
import { intervalsOverlap, requireReservationTransition, reservationBlocksAvailability } from "@/server/reservations/reservation-policy";
import { formatForDateTimeLocal, zonedDateTimeToUtc } from "@/server/reservations/timezone";

const date = (hour: number, minute = 0) => new Date(Date.UTC(2026, 7, 31, hour, minute));

describe("semi-open reservation intervals", () => {
  const start = date(10);
  const end = date(12);
  it.each([
    [date(8), date(10), false],
    [date(12), date(14), false],
    [date(9), date(11), true],
    [date(11), date(13), true],
    [date(10), date(12), true],
    [date(10, 30), date(11, 30), true],
    [date(9), date(13), true],
  ])("compares the requested interval", (requestedStart, requestedEnd, expected) => {
    expect(intervalsOverlap(start, end, requestedStart, requestedEnd)).toBe(expected);
  });
});

describe("reservation status policy", () => {
  it("blocks approval workflow states consistently", () => {
    expect(reservationBlocksAvailability("DRAFT")).toBe(false);
    expect(reservationBlocksAvailability("PENDING_APPROVAL")).toBe(true);
    expect(reservationBlocksAvailability("APPROVED")).toBe(true);
    expect(reservationBlocksAvailability("REJECTED")).toBe(false);
    expect(reservationBlocksAvailability("CONFIRMED")).toBe(true);
    expect(reservationBlocksAvailability("CANCELLED")).toBe(false);
  });

  it("rejects cancelled to confirmed", () => {
    expect(() => requireReservationTransition("CANCELLED", "CONFIRMED")).toThrow();
  });

  it("allows the initial state transitions", () => {
    expect(() => requireReservationTransition("DRAFT", "PENDING_APPROVAL")).not.toThrow();
    expect(() => requireReservationTransition("PENDING_APPROVAL", "APPROVED")).not.toThrow();
    expect(() => requireReservationTransition("PENDING_APPROVAL", "REJECTED")).not.toThrow();
    expect(() => requireReservationTransition("REJECTED", "DRAFT")).not.toThrow();
    expect(() => requireReservationTransition("APPROVED", "CONFIRMED")).not.toThrow();
    expect(() => requireReservationTransition("CONFIRMED", "CANCELLED")).not.toThrow();
  });

  it("rejects unsafe approval transitions", () => {
    expect(() => requireReservationTransition("APPROVED", "REJECTED")).toThrow();
    expect(() => requireReservationTransition("CANCELLED", "APPROVED")).toThrow();
    expect(() => requireReservationTransition("CONFIRMED", "DRAFT")).toThrow();
  });
});

describe("tenant timezone", () => {
  it("converts a São Paulo wall time to UTC and back", () => {
    const utc = zonedDateTimeToUtc("2026-08-31T10:00", "America/Sao_Paulo");
    expect(utc.toISOString()).toBe("2026-08-31T13:00:00.000Z");
    expect(formatForDateTimeLocal(utc, "America/Sao_Paulo")).toBe("2026-08-31T10:00");
  });
});
