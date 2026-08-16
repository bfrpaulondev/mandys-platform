import {
  createEventLeadSchema,
  eventLeadIdParamsSchema,
  eventLeadListQuerySchema,
  updateEventLeadStatusSchema,
} from "@mandys/contracts";
import {
  createEventLead,
  EventLeadNotFoundError,
  EventLeadReferenceError,
  EventsModuleDisabledError,
  InvalidEventLeadTransitionError,
  listEventLeads,
  updateEventLeadStatus,
} from "@mandys/database";
import type { FastifyInstance, FastifyReply } from "fastify";

import { assertRole, getTenantContext } from "../auth/context";

function replyForEventError(error: unknown, reply: FastifyReply) {
  if (error instanceof EventsModuleDisabledError) {
    return reply.status(403).send({ error: error.name, message: error.message });
  }

  if (error instanceof EventLeadNotFoundError) {
    return reply.status(404).send({ error: error.name, message: error.message });
  }

  if (error instanceof EventLeadReferenceError || error instanceof InvalidEventLeadTransitionError) {
    return reply.status(422).send({ error: error.name, message: error.message });
  }

  throw error;
}

export async function registerEventRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/events", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager", "reception", "marketing"]);

    const parsed = eventLeadListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        message: "Event filters are invalid",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const data = await listEventLeads(
        { organizationId: context.organizationId, userId: context.userId },
        parsed.data,
      );
      return { data };
    } catch (error) {
      return replyForEventError(error, reply);
    }
  });

  app.post("/v1/events", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager", "reception", "marketing"]);

    const parsed = createEventLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "Event lead data is invalid",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const data = await createEventLead(
        { organizationId: context.organizationId, userId: context.userId },
        parsed.data,
      );
      return reply.status(201).send({ data });
    } catch (error) {
      return replyForEventError(error, reply);
    }
  });

  app.patch("/v1/events/:eventLeadId/status", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager", "reception", "marketing"]);

    const params = eventLeadIdParamsSchema.safeParse(request.params);
    const body = updateEventLeadStatusSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "Event lead status update is invalid",
        issues: {
          params: params.success ? undefined : params.error.flatten(),
          body: body.success ? undefined : body.error.flatten(),
        },
      });
    }

    try {
      const data = await updateEventLeadStatus(
        { organizationId: context.organizationId, userId: context.userId },
        params.data.eventLeadId,
        body.data.status,
      );
      return { data };
    } catch (error) {
      return replyForEventError(error, reply);
    }
  });
}
