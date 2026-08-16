import type {
  CreateEventLeadInput,
  EventLeadListQuery,
  EventLeadStatus,
} from "@mandys/contracts";
import { and, desc, eq } from "drizzle-orm";

import {
  auditLogs,
  customers,
  eventLeads,
  locations,
  moduleEntitlements,
} from "./schema";
import { withTenant, type TenantDatabaseContext, type TenantTransaction } from "./tenant";

const allowedTransitions: Record<EventLeadStatus, readonly EventLeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["proposal_sent", "lost"],
  proposal_sent: ["deposit_pending", "confirmed", "lost"],
  deposit_pending: ["confirmed", "lost"],
  confirmed: ["completed", "lost"],
  completed: [],
  lost: [],
};

export class EventsModuleDisabledError extends Error {
  constructor() {
    super("The events module is not enabled for this restaurant");
    this.name = "EventsModuleDisabledError";
  }
}

export class EventLeadNotFoundError extends Error {
  constructor() {
    super("Event lead not found");
    this.name = "EventLeadNotFoundError";
  }
}

export class EventLeadReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventLeadReferenceError";
  }
}

export class InvalidEventLeadTransitionError extends Error {
  constructor(from: EventLeadStatus, to: EventLeadStatus) {
    super(`Event lead status cannot transition from ${from} to ${to}`);
    this.name = "InvalidEventLeadTransitionError";
  }
}

async function assertEventsEnabled(tx: TenantTransaction, organizationId: string): Promise<void> {
  const [entitlement] = await tx
    .select({ status: moduleEntitlements.status })
    .from(moduleEntitlements)
    .where(
      and(
        eq(moduleEntitlements.organizationId, organizationId),
        eq(moduleEntitlements.moduleKey, "events"),
      ),
    )
    .limit(1);

  if (!entitlement || entitlement.status === "disabled") {
    throw new EventsModuleDisabledError();
  }
}

export async function listEventLeads(
  context: TenantDatabaseContext,
  query: EventLeadListQuery,
) {
  return withTenant(context, async (tx) => {
    await assertEventsEnabled(tx, context.organizationId);

    return tx
      .select()
      .from(eventLeads)
      .where(
        and(
          eq(eventLeads.organizationId, context.organizationId),
          query.status ? eq(eventLeads.status, query.status) : undefined,
          query.locationId ? eq(eventLeads.locationId, query.locationId) : undefined,
        ),
      )
      .orderBy(desc(eventLeads.createdAt))
      .limit(query.limit);
  });
}

export async function createEventLead(
  context: TenantDatabaseContext,
  input: CreateEventLeadInput,
) {
  return withTenant(context, async (tx) => {
    await assertEventsEnabled(tx, context.organizationId);

    if (input.locationId) {
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

      if (!location) throw new EventLeadReferenceError("The selected location is not available");
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
        throw new EventLeadReferenceError("The selected customer does not belong to this restaurant");
      }
    }

    const [created] = await tx
      .insert(eventLeads)
      .values({
        organizationId: context.organizationId,
        eventType: input.eventType,
        contactName: input.contactName,
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
        ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
        ...(input.eventAt ? { eventAt: input.eventAt } : {}),
        ...(input.partySize !== undefined ? { partySize: input.partySize } : {}),
        ...(input.budgetMinCents !== undefined ? { budgetMinCents: input.budgetMinCents } : {}),
        ...(input.budgetMaxCents !== undefined ? { budgetMaxCents: input.budgetMaxCents } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      })
      .returning();

    if (!created) throw new Error("Event lead could not be created");

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "event_lead.created",
      entityType: "event_lead",
      entityId: created.id,
      metadata: {
        eventType: created.eventType,
        locationId: created.locationId,
        partySize: created.partySize,
        eventAt: created.eventAt?.toISOString() ?? null,
      },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return created;
  });
}

export async function updateEventLeadStatus(
  context: TenantDatabaseContext,
  eventLeadId: string,
  status: EventLeadStatus,
) {
  return withTenant(context, async (tx) => {
    await assertEventsEnabled(tx, context.organizationId);

    const [current] = await tx
      .select()
      .from(eventLeads)
      .where(
        and(
          eq(eventLeads.organizationId, context.organizationId),
          eq(eventLeads.id, eventLeadId),
        ),
      )
      .limit(1);

    if (!current) throw new EventLeadNotFoundError();
    if (current.status === status) return current;

    const nextStatuses = allowedTransitions[current.status as EventLeadStatus] ?? [];
    if (!nextStatuses.includes(status)) {
      throw new InvalidEventLeadTransitionError(current.status as EventLeadStatus, status);
    }

    const [updated] = await tx
      .update(eventLeads)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(eventLeads.organizationId, context.organizationId),
          eq(eventLeads.id, eventLeadId),
          eq(eventLeads.status, current.status),
        ),
      )
      .returning();

    if (!updated) throw new EventLeadNotFoundError();

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "event_lead.status_changed",
      entityType: "event_lead",
      entityId: updated.id,
      metadata: { from: current.status, to: updated.status },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return updated;
  });
}
