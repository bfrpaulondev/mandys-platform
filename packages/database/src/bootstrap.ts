import { and, eq } from "drizzle-orm";

import {
  auditLogs,
  locations,
  moduleEntitlements,
  restaurantProfiles,
  tenantSettings,
  tenantThemeSettings,
  themeEntitlements,
} from "./schema";
import { withTenant } from "./tenant";

export interface BootstrapRestaurantInput {
  organizationId: string;
  actorUserId: string;
  publicName: string;
  legalName?: string;
  locationName: string;
  slug: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  countryCode: string;
  timezone: string;
  currency: string;
  defaultLocale: "pt-PT" | "pt-BR" | "en" | "es";
  enabledLocales: Array<"pt-PT" | "pt-BR" | "en" | "es">;
}

export interface BootstrapRestaurantResult {
  organizationId: string;
  locationId: string;
  profileId: string;
  slug: string;
  created: boolean;
}

const initialModules = [
  ["core", "enabled"],
  ["menu", "enabled"],
  ["reservations", "enabled"],
  ["events", "enabled"],
  ["crm", "disabled"],
  ["orders", "disabled"],
  ["stock", "disabled"],
  ["analytics", "disabled"],
  ["ai", "disabled"],
  ["multi_location", "disabled"],
  ["loyalty", "disabled"],
] as const;

export async function bootstrapRestaurant(
  input: BootstrapRestaurantInput,
): Promise<BootstrapRestaurantResult> {
  return withTenant(
    { organizationId: input.organizationId, userId: input.actorUserId },
    async (tx) => {
      const existingLocation = await tx.query.locations.findFirst({
        where: and(
          eq(locations.organizationId, input.organizationId),
          eq(locations.slug, input.slug),
        ),
      });

      if (existingLocation) {
        const existingProfile = await tx.query.restaurantProfiles.findFirst({
          where: and(
            eq(restaurantProfiles.organizationId, input.organizationId),
            eq(restaurantProfiles.locationId, existingLocation.id),
          ),
        });

        if (!existingProfile) {
          throw new Error("Restaurant location exists without a profile");
        }

        return {
          organizationId: input.organizationId,
          locationId: existingLocation.id,
          profileId: existingProfile.id,
          slug: existingLocation.slug,
          created: false,
        };
      }

      await tx
        .insert(tenantSettings)
        .values({
          organizationId: input.organizationId,
          defaultLocale: input.defaultLocale,
          enabledLocales: input.enabledLocales,
          timezone: input.timezone,
          currency: input.currency,
        })
        .onConflictDoNothing({ target: tenantSettings.organizationId });

      const [location] = await tx
        .insert(locations)
        .values({
          organizationId: input.organizationId,
          name: input.locationName,
          slug: input.slug,
          email: input.email,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          postalCode: input.postalCode,
          city: input.city,
          countryCode: input.countryCode.toUpperCase(),
        })
        .returning({ id: locations.id, slug: locations.slug });

      if (!location) {
        throw new Error("Failed to create restaurant location");
      }

      const [profile] = await tx
        .insert(restaurantProfiles)
        .values({
          organizationId: input.organizationId,
          locationId: location.id,
          publicName: input.publicName,
          legalName: input.legalName,
          contactEmail: input.email,
          contactPhone: input.phone,
        })
        .returning({ id: restaurantProfiles.id });

      if (!profile) {
        throw new Error("Failed to create restaurant profile");
      }

      await tx
        .insert(moduleEntitlements)
        .values(
          initialModules.map(([moduleKey, status]) => ({
            organizationId: input.organizationId,
            moduleKey,
            status,
            activatedAt: status === "enabled" ? new Date() : null,
            plan: status === "enabled" ? "v0.1" : null,
          })),
        )
        .onConflictDoNothing();

      await tx
        .insert(themeEntitlements)
        .values({
          organizationId: input.organizationId,
          themeKey: "minimal",
          status: "enabled",
          licenseType: "included",
          purchasedAt: new Date(),
        })
        .onConflictDoNothing();

      await tx
        .insert(tenantThemeSettings)
        .values({
          organizationId: input.organizationId,
          themeKey: "minimal",
          variant: "light",
        })
        .onConflictDoNothing({ target: tenantThemeSettings.organizationId });

      await tx.insert(auditLogs).values({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "restaurant.onboarded",
        entityType: "restaurant_profile",
        entityId: profile.id,
        metadata: {
          locationId: location.id,
          slug: location.slug,
          enabledModules: initialModules
            .filter(([, status]) => status === "enabled")
            .map(([moduleKey]) => moduleKey),
        },
      });

      return {
        organizationId: input.organizationId,
        locationId: location.id,
        profileId: profile.id,
        slug: location.slug,
        created: true,
      };
    },
  );
}
