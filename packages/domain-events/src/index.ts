export type DomainEventName =
  | "reservation.created"
  | "reservation.confirmed"
  | "reservation.cancelled"
  | "menu.item.updated"
  | "menu.published"
  | "customer.created"
  | "event_lead.created"
  | "event_lead.confirmed"
  | "order.created"
  | "order.paid"
  | "stock.adjusted";

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  name: DomainEventName;
  organizationId: string;
  actorUserId?: string;
  occurredAt: Date;
  payload: TPayload;
}

export interface DomainEventPublisher {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}

export function createDomainEvent<TPayload>(input: {
  name: DomainEventName;
  organizationId: string;
  actorUserId?: string;
  payload: TPayload;
  occurredAt?: Date;
  id?: string;
}): DomainEvent<TPayload> {
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    occurredAt: input.occurredAt ?? new Date(),
    payload: input.payload,
  };
}
