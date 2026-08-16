import { restaurantOnboardingSchema } from "@mandys/contracts";
import { bootstrapRestaurant } from "@mandys/database";
import type { FastifyInstance } from "fastify";

import { assertRole, getTenantContext } from "../auth/context";

export async function registerOnboardingRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/onboarding/restaurant",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const context = await getTenantContext(request);
      assertRole(context, ["owner", "manager"]);

      const parsed = restaurantOnboardingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_REQUEST",
          message: "Restaurant onboarding data is invalid",
          issues: parsed.error.flatten(),
        });
      }

      const result = await bootstrapRestaurant({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        ...parsed.data,
      });

      return reply.status(result.created ? 201 : 200).send({
        data: result,
      });
    },
  );
}
