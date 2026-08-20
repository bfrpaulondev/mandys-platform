import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "./client";
import {
  auditLogs,
  domains,
  locations,
  moduleEntitlements,
  openingHours,
  reservations,
  tenantSettings,
} from "./schema";
import { reservationFitsOpeningWindow, specialOpeningHours, zonedDateAndMinutes } from "./special-hours";
import { withTenant } from "./tenant";

export class PublicReservationUnavailableError extends Error {
  constructor(message = "Reservations are not available for this restaurant") {
    super(message);
    this.name = "PublicReservationUnavailableError";
  }
}

export type PublicReservationInput = {
  hostname: string;
  startsAt: Date;
  endsAt: Date;
  partySize: number;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  notes?: string;
};

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!.split(":")[0]!;
}

function serviceDateDayDelta(startDate: string, endDate: string): number {
  return Math.round(
    (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) /
      (24 * 60 * 60 * 1000),
  );
}

export async function createPublicReservation(input: PublicReservationInput) {
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new PublicReservationUnavailableError();

  const [domain] = await db
    .select({ organizationId: domains.organizationId })
    .from(domains)
    .where(and(eq(domains.hostname, hostname), isNotNull(domains.verifiedAt)))
    .limit(1);

  if (!domain) throw new PublicReservationUnavailableError();

  return withTenant({ organizationId: domain.organizationId }, async (tx) => {
    const [entitlement] = await tx
      .select({ status: moduleEntitlements.status })
      .from(moduleEntitlements)
      .where(
        and(
          eq(moduleEntitlements.organizationId, domain.organizationId),
          eq(moduleEntitlements.moduleKey, "reservations"),
        ),
      )
      .limit(1);

    if (!entitlement || entitlement.status === "disabled") {
      throw new PublicReservationUnavailableError();
    }

    const [settings] = await tx
      .select({ timezone: tenantSettings.timezone })
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, domain.organizationId))
      .limit(1);

    if (!settings) throw new PublicReservationUnavailableError();

    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.organizationId, domain.organizationId), eq(locations.isActive, true)))
      .orderBy(locations.createdAt)
      .limit(1);

    if (!location) throw new PublicReservationUnavailableError();

    const localStart = zonedDateAndMinutes(input.startsAt, settings.timezone);
    const localEnd = zonedDateAndMinutes(input.endsAt, settings.timezone);
    const dayDelta = serviceDateDayDelta(localStart.serviceDate, localEnd.serviceDate);
    if (dayDelta < 0 || dayDelta > 1) {
      throw new PublicReservationUnavailableError("Reservation time is outside restaurant service hours");
    }

    const [special] = await tx
      .select({
        opensAt: specialOpeningHours.opensAt,
        closesAt: specialOpeningHours.closesAt,
        isClosed: specialOpeningHours.isClosed,
      })
      .from(specialOpeningHours)
      .where(
        and(
          eq(specialOpeningHours.organizationId, domain.organizationId),
          eq(specialOpeningHours.locationId, location.id),
          eq(specialOpeningHours.serviceDate, localStart.serviceDate),
        ),
      )
      .limit(1);

    let serviceWindow = special ?? null;
    if (!serviceWindow) {
      const weekday = new Date(`${localStart.serviceDate}T12:00:00.000Z`).getUTCDay();
      const [weekly] = await tx
        .select({
          opensAt: openingHours.opensAt,
          closesAt: openingHours.closesAt,
          isClosed: openingHours.isClosed,
        })
        .from(openingHours)
        .where(
          and(
            eq(openingHours.organizationId, domain.organizationId),
            eq(openingHours.locationId, location.id),
            eq(openingHours.weekday, weekday),
          ),
        )
        .limit(1);
      serviceWindow = weekly ?? null;
    }

    if (
      !serviceWindow ||
      !reservationFitsOpeningWindow(
        localStart.minutes,
        localEnd.minutes + dayDelta * 24 * 60,
        serviceWindow,
      )
    ) {
      throw new PublicReservationUnavailableError("Reservation time is outside restaurant service hours");
    }

    const identityMatch = input.guestEmail
      ? eq(reservations.guestEmail, input.guestEmail)
      : input.guestPhone
        ? eq(reservations.guestPhone, input.guestPhone)
        : eq(reservations.guestName, input.guestName);

    const [existing] = await tx
      .select({
        id: reservations.id,
        startsAt: reservations.startsAt,
        endsAt: reservations.endsAt,
        partySize: reservations.partySize,
        status: reservations.status,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, domain.organizationId),
          eq(reservations.locationId, location.id),
          eq(reservations.startsAt, input.startsAt),
          eq(reservations.partySize, input.partySize),
          eq(reservations.guestName, input.guestName),
          eq(reservations.source, "storefront"),
          identityMatch,
        ),
      )
      .orderBy(reservations.createdAt)
      .limit(1);

    if (existing) return existing;

    const [created] = await tx
      .insert(reservations)
      .values({
        organizationId: domain.organizationId,
        locationId: location.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        partySize: input.partySize,
        guestName: input.guestName,
        guestEmail: input.guestEmail ?? null,
        guestPhone: input.guestPhone ?? null,
        notes: input.notes ?? null,
        source: "storefront",
        status: "pending",
      })
      .returning({
        id: reservations.id,
        startsAt: reservations.startsAt,
        endsAt: reservations.endsAt,
        partySize: reservations.partySize,
        status: reservations.status,
      });

    if (!created) throw new Error("Reservation could not be created");

    await tx.insert(auditLogs).values({
      organizationId: domain.organizationId,
      action: "reservation.public_created",
      entityType: "reservation",
      entityId: created.id,
      metadata: {
        source: "storefront",
        locationId: location.id,
        partySize: created.partySize,
        startsAt: created.startsAt.toISOString(),
      },
    });

    return created;
  });
}
