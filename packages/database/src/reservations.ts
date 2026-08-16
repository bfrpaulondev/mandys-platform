import type {
  CreateReservationInput,
  ReservationListQuery,
  ReservationStatus,
} from "@mandys/contracts";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";

import {
  auditLogs,
  customers,
  diningAreas,
  locations,
  moduleEntitlements,
  reservations,
  restaurantTables,
} from "./schema";
import {
  withTenant,
  type TenantDatabaseContext,
  type TenantTransaction,
} from "./tenant";

const activeReservationStatuses: ReservationStatus[] = ["pending", "confirmed", "seated"];

const allowedStatusTransitions: Record<ReservationStatus, readonly ReservationStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export class ReservationsModuleDisabledError extends Error {
  constructor() {
    super("The reservations module is not enabled for this restaurant");
    this.name = "ReservationsModuleDisabledError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor() {
    super("Reservation not found");
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationConflictError extends Error {
  constructor() {
    super("The selected table already has an overlapping reservation");
    this.name = "ReservationConflictError";
  }
}

export class ReservationReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationReferenceError";
  }
}

export class InvalidReservationTransitionError extends Error {
  constructor(from: ReservationStatus, to: ReservationStatus) {
    super(`Reservation status cannot transition from ${from} to ${to}`);
    this.name = "InvalidReservationTransitionError";
  }
}

async function assertReservationsEnabled(
  tx: TenantTransaction,
  organizationId: string,
): Promise<void> {
  const [entitlement] = await tx
    .select({ status: moduleEntitlements.status })
    .from(moduleEntitlements)
    .where(
      and(
        eq(moduleEntitlements.organizationId, organizationId),
        eq(moduleEntitlements.moduleKey, "reservations"),
      ),
    )
    .limit(1);

  if (!entitlement || entitlement.status === "disabled") {
    throw new ReservationsModuleDisabledError();
  }
}

export async function listReservations(
  context: TenantDatabaseContext,
  query: ReservationListQuery,
) {
  return withTenant(context, async (tx) => {
    await assertReservationsEnabled(tx, context.organizationId);

    return tx
      .select({
        id: reservations.id,
        locationId: reservations.locationId,
        customerId: reservations.customerId,
        diningAreaId: reservations.diningAreaId,
        tableId: reservations.tableId,
        guestName: reservations.guestName,
        guestEmail: reservations.guestEmail,
        guestPhone: reservations.guestPhone,
        startsAt: reservations.startsAt,
        endsAt: reservations.endsAt,
        partySize: reservations.partySize,
        status: reservations.status,
        notes: reservations.notes,
        source: reservations.source,
        createdAt: reservations.createdAt,
        updatedAt: reservations.updatedAt,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, context.organizationId),
          query.locationId ? eq(reservations.locationId, query.locationId) : undefined,
          query.status ? eq(reservations.status, query.status) : undefined,
          query.from ? gt(reservations.endsAt, query.from) : undefined,
          query.to ? lt(reservations.startsAt, query.to) : undefined,
        ),
      )
      .orderBy(asc(reservations.startsAt))
      .limit(query.limit);
  });
}

export async function createReservation(
  context: TenantDatabaseContext,
  input: CreateReservationInput,
) {
  return withTenant(context, async (tx) => {
    await assertReservationsEnabled(tx, context.organizationId);

    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, context.organizationId),
          eq(locations.id, input.locationId),
          eq(locations.isActive, true),
        ),
      )
      .limit(1);

    if (!location) {
      throw new ReservationReferenceError("The selected location is not available");
    }

    if (input.customerId) {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, context.organizationId),
            eq(customers.id, input.customerId),
          ),
        )
        .limit(1);

      if (!customer) {
        throw new ReservationReferenceError("The selected customer does not belong to this restaurant");
      }
    }

    if (input.diningAreaId) {
      const [area] = await tx
        .select({ id: diningAreas.id })
        .from(diningAreas)
        .where(
          and(
            eq(diningAreas.organizationId, context.organizationId),
            eq(diningAreas.locationId, input.locationId),
            eq(diningAreas.id, input.diningAreaId),
            eq(diningAreas.isActive, true),
          ),
        )
        .limit(1);

      if (!area) {
        throw new ReservationReferenceError("The selected dining area is not available at this location");
      }
    }

    if (input.tableId) {
      const [table] = await tx
        .select({ id: restaurantTables.id, diningAreaId: restaurantTables.diningAreaId })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.organizationId, context.organizationId),
            eq(restaurantTables.locationId, input.locationId),
            eq(restaurantTables.id, input.tableId),
            eq(restaurantTables.isActive, true),
          ),
        )
        .limit(1);

      if (!table) {
        throw new ReservationReferenceError("The selected table is not available at this location");
      }

      if (input.diningAreaId && table.diningAreaId !== input.diningAreaId) {
        throw new ReservationReferenceError("The selected table does not belong to the selected dining area");
      }

      const [conflict] = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(
          and(
            eq(reservations.organizationId, context.organizationId),
            eq(reservations.tableId, input.tableId),
            inArray(reservations.status, activeReservationStatuses),
            lt(reservations.startsAt, input.endsAt),
            gt(reservations.endsAt, input.startsAt),
          ),
        )
        .limit(1);

      if (conflict) {
        throw new ReservationConflictError();
      }
    }

    const [created] = await tx
      .insert(reservations)
      .values({
        organizationId: context.organizationId,
        locationId: input.locationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        partySize: input.partySize,
        guestName: input.guestName,
        source: "backoffice",
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.diningAreaId ? { diningAreaId: input.diningAreaId } : {}),
        ...(input.tableId ? { tableId: input.tableId } : {}),
        ...(input.guestEmail ? { guestEmail: input.guestEmail } : {}),
        ...(input.guestPhone ? { guestPhone: input.guestPhone } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      })
      .returning();

    if (!created) {
      throw new Error("Reservation could not be created");
    }

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "reservation.created",
      entityType: "reservation",
      entityId: created.id,
      metadata: {
        locationId: created.locationId,
        tableId: created.tableId,
        partySize: created.partySize,
        startsAt: created.startsAt.toISOString(),
      },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return created;
  });
}

export async function updateReservationStatus(
  context: TenantDatabaseContext,
  reservationId: string,
  status: ReservationStatus,
) {
  return withTenant(context, async (tx) => {
    await assertReservationsEnabled(tx, context.organizationId);

    const [current] = await tx
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, context.organizationId),
          eq(reservations.id, reservationId),
        ),
      )
      .limit(1);

    if (!current) {
      throw new ReservationNotFoundError();
    }

    if (current.status === status) return current;

    const nextStatuses = allowedStatusTransitions[current.status as ReservationStatus] ?? [];
    if (!nextStatuses.includes(status)) {
      throw new InvalidReservationTransitionError(current.status as ReservationStatus, status);
    }

    const [updated] = await tx
      .update(reservations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reservations.organizationId, context.organizationId),
          eq(reservations.id, reservationId),
          eq(reservations.status, current.status),
        ),
      )
      .returning();

    if (!updated) {
      throw new ReservationConflictError();
    }

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "reservation.status_changed",
      entityType: "reservation",
      entityId: updated.id,
      metadata: {
        from: current.status,
        to: updated.status,
      },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return updated;
  });
}
