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
  it("blocks only pending and confirmed reservations", () => {
    expect(reservationBlocksAvailability("DRAFT")).toBe(false);
    expect(reservationBlocksAvailability("PENDING")).toBe(true);
    expect(reservationBlocksAvailability("CONFIRMED")).toBe(true);
    expect(reservationBlocksAvailability("CANCELLED")).toBe(false);
  });

  it("rejects cancelled to confirmed", () => {
    expect(() => requireReservationTransition("CANCELLED", "CONFIRMED")).toThrow();
  });

  it("allows the initial state transitions", () => {
    expect(() => requireReservationTransition("DRAFT", "PENDING")).not.toThrow();
    expect(() => requireReservationTransition("PENDING", "CONFIRMED")).not.toThrow();
    expect(() => requireReservationTransition("CONFIRMED", "CANCELLED")).not.toThrow();
  });
});

describe("tenant timezone", () => {
  it("converts a São Paulo wall time to UTC and back", () => {
    const utc = zonedDateTimeToUtc("2026-08-31T10:00", "America/Sao_Paulo");
    expect(utc.toISOString()).toBe("2026-08-31T13:00:00.000Z");
    expect(formatForDateTimeLocal(utc, "America/Sao_Paulo")).toBe("2026-08-31T10:00");
  });
});
