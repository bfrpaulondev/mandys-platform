import {
  createReservationSchema,
  reservationIdParamsSchema,
  reservationListQuerySchema,
  updateReservationStatusSchema,
} from "@mandys/contracts";
import {
  createReservation,
  InvalidReservationTransitionError,
  listReservations,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationReferenceError,
  ReservationsModuleDisabledError,
  updateReservationStatus,
} from "@mandys/database";
import type { FastifyInstance, FastifyReply } from "fastify";

import { assertRole, getTenantContext } from "../auth/context";

function replyForReservationError(error: unknown, reply: FastifyReply) {
  if (error instanceof ReservationsModuleDisabledError) {
    return reply.status(403).send({
      error: error.name,
      message: error.message,
    });
  }

  if (error instanceof ReservationNotFoundError) {
    return reply.status(404).send({
      error: error.name,
      message: error.message,
    });
  }

  if (error instanceof ReservationConflictError) {
    return reply.status(409).send({
      error: error.name,
      message: error.message,
    });
  }

  if (error instanceof ReservationReferenceError || error instanceof InvalidReservationTransitionError) {
    return reply.status(422).send({
      error: error.name,
      message: error.message,
    });
  }

  throw error;
}

export async function registerReservationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/reservations", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager", "reception", "kitchen", "staff"]);

    const parsed = reservationListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        message: "Reservation filters are invalid",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const data = await listReservations(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        parsed.data,
      );

      return { data };
    } catch (error) {
      return replyForReservationError(error, reply);
    }
  });

  app.post(
    "/v1/reservations",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const context = await getTenantContext(request);
      assertRole(context, ["owner", "manager", "reception"]);

      const parsed = createReservationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_REQUEST",
          message: "Reservation data is invalid",
          issues: parsed.error.flatten(),
        });
      }

      try {
        const data = await createReservation(
          {
            organizationId: context.organizationId,
            userId: context.userId,
          },
          parsed.data,
        );

        return reply.status(201).send({ data });
      } catch (error) {
        return replyForReservationError(error, reply);
      }
    },
  );

  app.patch("/v1/reservations/:reservationId/status", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager", "reception"]);

    const params = reservationIdParamsSchema.safeParse(request.params);
    const body = updateReservationStatusSchema.safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "Reservation status update is invalid",
        issues: {
          params: params.success ? undefined : params.error.flatten(),
          body: body.success ? undefined : body.error.flatten(),
        },
      });
    }

    try {
      const data = await updateReservationStatus(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        params.data.reservationId,
        body.data.status,
      );

      return { data };
    } catch (error) {
      return replyForReservationError(error, reply);
    }
  });
}
