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

      const data = parsed.data;
      const result = await bootstrapRestaurant({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        publicName: data.publicName,
        locationName: data.locationName,
        slug: data.slug,
        countryCode: data.countryCode,
        timezone: data.timezone,
        currency: data.currency,
        defaultLocale: data.defaultLocale,
        enabledLocales: data.enabledLocales,
        ...(data.legalName === undefined ? {} : { legalName: data.legalName }),
        ...(data.email === undefined ? {} : { email: data.email }),
        ...(data.phone === undefined ? {} : { phone: data.phone }),
        ...(data.addressLine1 === undefined ? {} : { addressLine1: data.addressLine1 }),
        ...(data.addressLine2 === undefined ? {} : { addressLine2: data.addressLine2 }),
        ...(data.postalCode === undefined ? {} : { postalCode: data.postalCode }),
        ...(data.city === undefined ? {} : { city: data.city }),
      });

      return reply.status(result.created ? 201 : 200).send({
        data: result,
      });
    },
  );
}
