import { describe, expect, it } from "vitest";

import { reservationFitsOpeningWindow, zonedDateAndMinutes } from "./special-hours";

describe("special opening hours", () => {
  it("rejects closed dates and reservations outside a daytime window", () => {
    expect(reservationFitsOpeningWindow(12 * 60, 13 * 60, { isClosed: true, opensAt: null, closesAt: null })).toBe(false);
    expect(reservationFitsOpeningWindow(10 * 60, 11 * 60, { isClosed: false, opensAt: "12:00", closesAt: "23:00" })).toBe(false);
    expect(reservationFitsOpeningWindow(22 * 60, 23 * 60 + 30, { isClosed: false, opensAt: "12:00", closesAt: "23:00" })).toBe(false);
  });

  it("accepts reservations fully contained in daytime and overnight windows", () => {
    expect(reservationFitsOpeningWindow(19 * 60, 20 * 60 + 30, { isClosed: false, opensAt: "12:00", closesAt: "23:00" })).toBe(true);
    expect(reservationFitsOpeningWindow(23 * 60, 60, { isClosed: false, opensAt: "18:00", closesAt: "02:00" })).toBe(true);
  });

  it("resolves restaurant-local date and minutes from an instant", () => {
    const lisbon = zonedDateAndMinutes(new Date("2026-12-24T23:30:00.000Z"), "Europe/Lisbon");
    expect(lisbon.serviceDate).toBe("2026-12-24");
    expect(lisbon.minutes).toBe(23 * 60 + 30);

    const newYork = zonedDateAndMinutes(new Date("2026-12-25T02:30:00.000Z"), "America/New_York");
    expect(newYork.serviceDate).toBe("2026-12-24");
    expect(newYork.minutes).toBe(21 * 60 + 30);
  });
});
