import { describe, expect, it } from "vitest";

import { createReservationTimeFormatter } from "./reservation-time";

describe("reservation slot time formatting", () => {
  it("formats slots in the restaurant timezone instead of the browser timezone", () => {
    const startsAt = new Date("2026-08-17T18:00:00.000Z");

    expect(createReservationTimeFormatter("pt-PT", "Europe/Lisbon").format(startsAt)).toBe(
      "19:00",
    );
    expect(createReservationTimeFormatter("pt-PT", "America/New_York").format(startsAt)).toBe(
      "14:00",
    );
  });
});
