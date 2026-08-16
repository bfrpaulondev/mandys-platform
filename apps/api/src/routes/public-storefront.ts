import { locales } from "@mandys/contracts";
import {
  createPublicReservation,
  getPublicStorefrontByHostname,
  PublicReservationUnavailableError,
  PublicStorefrontNotFoundError,
} from "@mandys/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const hostnameSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .transform((value) => value.toLowerCase());

const publicStorefrontQuerySchema = z.object({
  hostname: hostnameSchema,
  locale: z.enum(locales).default("pt-PT"),
});

const publicReservationSchema = z.object({
  hostname: hostnameSchema,
  startsAt: z.coerce.date(),
  partySize: z.number().int().min(1).max(100),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

export async function registerPublicStorefrontRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/public/storefront",
    {
      config: {
        rateLimit: {
          max: 180,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = publicStorefrontQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_QUERY",
          message: "Storefront request is invalid",
          issues: parsed.error.flatten(),
        });
      }

      try {
        const data = await getPublicStorefrontByHostname(parsed.data);
        return { data };
      } catch (error) {
        if (error instanceof PublicStorefrontNotFoundError) {
          return reply.status(404).send({
            error: error.name,
            message: error.message,
          });
        }
        throw error;
      }
    },
  );

  app.post(
    "/v1/public/reservations",
    {
      config: {
        rateLimit: {
          max: 12,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = publicReservationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_REQUEST",
          message: "Reservation data is invalid",
          issues: parsed.error.flatten(),
        });
      }

      const endsAt = new Date(parsed.data.startsAt.getTime() + 90 * 60_000);

      try {
        const data = await createPublicReservation({
          ...parsed.data,
          endsAt,
        });
        return reply.status(201).send({ data });
      } catch (error) {
        if (error instanceof PublicReservationUnavailableError) {
          return reply.status(404).send({
            error: error.name,
            message: error.message,
          });
        }
        throw error;
      }
    },
  );
}
