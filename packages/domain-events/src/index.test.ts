import { describe, expect, it } from "vitest";

import { createDomainEvent } from "./index";

describe("domain events", () => {
  it("carries tenant identity in every event", () => {
    const event = createDomainEvent({
      id: "evt_1",
      name: "reservation.created",
      organizationId: "org_1",
      payload: { reservationId: "res_1" },
      occurredAt: new Date("2026-08-16T12:00:00Z"),
    });

    expect(event).toMatchObject({
      id: "evt_1",
      name: "reservation.created",
      organizationId: "org_1",
      payload: { reservationId: "res_1" },
    });
  });
});
