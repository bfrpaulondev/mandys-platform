import { locales } from "@mandys/contracts";
import {
  getPublicStorefrontByHostname,
  PublicStorefrontNotFoundError,
} from "@mandys/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const publicStorefrontQuerySchema = z.object({
  hostname: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .transform((value) => value.toLowerCase()),
  locale: z.enum(locales).default("pt-PT"),
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
}
