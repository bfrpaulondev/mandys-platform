import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "./client";
import { auditLogs, domains, locations, moduleEntitlements, reservations } from "./schema";
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

    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.organizationId, domain.organizationId), eq(locations.isActive, true)))
      .orderBy(locations.createdAt)
      .limit(1);

    if (!location) throw new PublicReservationUnavailableError();

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
