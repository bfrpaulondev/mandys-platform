import { describe, expect, it } from "vitest";

import {
  createReservationSchema,
  reservationListQuerySchema,
  updateReservationStatusSchema,
} from "./index";

describe("reservation contracts", () => {
  it("accepts a valid reservation and coerces dates", () => {
    const parsed = createReservationSchema.parse({
      locationId: "0d4145f6-3b2d-41e1-a49c-64443592f9ce",
      startsAt: "2026-08-17T19:00:00.000Z",
      endsAt: "2026-08-17T20:30:00.000Z",
      partySize: 4,
      guestName: "João Silva",
      guestEmail: "joao@example.com",
    });

    expect(parsed.startsAt).toBeInstanceOf(Date);
    expect(parsed.endsAt).toBeInstanceOf(Date);
    expect(parsed.partySize).toBe(4);
  });

  it("rejects reservations whose end does not follow the start", () => {
    const parsed = createReservationSchema.safeParse({
      locationId: "0d4145f6-3b2d-41e1-a49c-64443592f9ce",
      startsAt: "2026-08-17T20:30:00.000Z",
      endsAt: "2026-08-17T19:00:00.000Z",
      partySize: 2,
      guestName: "Ana Costa",
    });

    expect(parsed.success).toBe(false);
  });

  it("caps list pagination and validates date windows", () => {
    expect(
      reservationListQuerySchema.safeParse({
        limit: "201",
      }).success,
    ).toBe(false);

    expect(
      reservationListQuerySchema.safeParse({
        from: "2026-08-18T00:00:00.000Z",
        to: "2026-08-17T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts supported reservation states only", () => {
    expect(updateReservationStatusSchema.parse({ status: "confirmed" }).status).toBe("confirmed");
    expect(updateReservationStatusSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});
