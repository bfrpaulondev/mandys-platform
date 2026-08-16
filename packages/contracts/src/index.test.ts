import { describe, expect, it } from "vitest";

import {
  createEventLeadSchema,
  createMenuItemSchema,
  createMenuSchema,
  createReservationSchema,
  eventLeadListQuerySchema,
  reservationListQuerySchema,
  updateEventLeadStatusSchema,
  updateMenuSchema,
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

describe("menu contracts", () => {
  it("accepts a multilingual menu with stable defaults", () => {
    const parsed = createMenuSchema.parse({
      internalName: "Dinner 2026",
      slug: "dinner-2026",
      translations: [
        { locale: "pt-PT", name: "Jantar" },
        { locale: "pt-BR", name: "Jantar" },
        { locale: "en", name: "Dinner" },
        { locale: "es", name: "Cena" },
      ],
    });

    expect(parsed.slug).toBe("dinner-2026");
    expect(parsed.translations).toHaveLength(4);
  });

  it("rejects duplicate translation locales", () => {
    expect(
      createMenuSchema.safeParse({
        internalName: "Main",
        slug: "main",
        translations: [
          { locale: "en", name: "Main menu" },
          { locale: "en", name: "Dinner menu" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects empty menu updates", () => {
    expect(updateMenuSchema.safeParse({}).success).toBe(false);
  });

  it("validates menu item money, media and allergens", () => {
    const parsed = createMenuItemSchema.parse({
      categoryId: "0d4145f6-3b2d-41e1-a49c-64443592f9ce",
      priceCents: 1290,
      imageUrl: "https://images.example.com/bacalhau.jpg",
      allergenIds: ["688719c5-5ef5-40ad-8363-7a54509c6670"],
      translations: [
        { locale: "pt-PT", name: "Bacalhau" },
        { locale: "en", name: "Codfish" },
      ],
    });

    expect(parsed.priceCents).toBe(1290);
    expect(parsed.isAvailable).toBe(true);
    expect(parsed.allergenIds).toHaveLength(1);
  });
});

describe("event lead contracts", () => {
  it("accepts a group event lead with optional commercial context", () => {
    const parsed = createEventLeadSchema.parse({
      eventType: "Corporate dinner",
      contactName: "Maria Costa",
      contactEmail: "maria@example.com",
      eventAt: "2026-09-18T19:30:00.000Z",
      partySize: 36,
      budgetMinCents: 180000,
      budgetMaxCents: 250000,
    });

    expect(parsed.eventAt).toBeInstanceOf(Date);
    expect(parsed.partySize).toBe(36);
  });

  it("rejects inverted budget ranges", () => {
    expect(
      createEventLeadSchema.safeParse({
        eventType: "Wedding",
        contactName: "Ana Silva",
        budgetMinCents: 400000,
        budgetMaxCents: 300000,
      }).success,
    ).toBe(false);
  });

  it("caps event pagination and validates supported states", () => {
    expect(eventLeadListQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
    expect(updateEventLeadStatusSchema.parse({ status: "proposal_sent" }).status).toBe("proposal_sent");
    expect(updateEventLeadStatusSchema.safeParse({ status: "cancelled" }).success).toBe(false);
  });
});