import { describe, expect, it } from "vitest";

import {
  createReservationTimeFormatter,
  restaurantDateInputValue,
} from "./reservation-time";

describe("reservation restaurant-local date and time", () => {
  it("formats slots in the restaurant timezone instead of the browser timezone", () => {
    const startsAt = new Date("2026-08-17T18:00:00.000Z");

    expect(createReservationTimeFormatter("pt-PT", "Europe/Lisbon").format(startsAt)).toBe(
      "19:00",
    );
    expect(createReservationTimeFormatter("pt-PT", "America/New_York").format(startsAt)).toBe(
      "14:00",
    );
  });

  it("derives booking calendar dates from the restaurant timezone", () => {
    const now = new Date("2026-08-17T23:30:00.000Z");

    expect(restaurantDateInputValue("Pacific/Kiritimati", 0, now)).toBe("2026-08-18");
    expect(restaurantDateInputValue("America/New_York", 0, now)).toBe("2026-08-17");
    expect(restaurantDateInputValue("Pacific/Kiritimati", 1, now)).toBe("2026-08-19");
  });
});
