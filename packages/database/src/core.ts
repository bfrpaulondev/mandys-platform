import { asc, eq } from "drizzle-orm";

import {
  locations,
  moduleEntitlements,
  restaurantProfiles,
  tenantSettings,
  tenantThemeSettings,
  themeEntitlements,
} from "./schema";
import { withTenant } from "./tenant";

export async function getTenantCoreSnapshot(context: {
  organizationId: string;
  userId: string;
}) {
  return withTenant(context, async (tx) => {
    const [settings] = await tx
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, context.organizationId))
      .limit(1);

    const tenantLocations = await tx
      .select()
      .from(locations)
      .where(eq(locations.organizationId, context.organizationId))
      .orderBy(asc(locations.createdAt));

    const profiles = await tx
      .select()
      .from(restaurantProfiles)
      .where(eq(restaurantProfiles.organizationId, context.organizationId))
      .orderBy(asc(restaurantProfiles.createdAt));

    const modules = await tx
      .select({
        moduleKey: moduleEntitlements.moduleKey,
        status: moduleEntitlements.status,
        plan: moduleEntitlements.plan,
        activatedAt: moduleEntitlements.activatedAt,
        expiresAt: moduleEntitlements.expiresAt,
      })
      .from(moduleEntitlements)
      .where(eq(moduleEntitlements.organizationId, context.organizationId))
      .orderBy(asc(moduleEntitlements.moduleKey));

    const themes = await tx
      .select({
        themeKey: themeEntitlements.themeKey,
        status: themeEntitlements.status,
        licenseType: themeEntitlements.licenseType,
        purchasedAt: themeEntitlements.purchasedAt,
      })
      .from(themeEntitlements)
      .where(eq(themeEntitlements.organizationId, context.organizationId))
      .orderBy(asc(themeEntitlements.themeKey));

    const [themeSettings] = await tx
      .select()
      .from(tenantThemeSettings)
      .where(eq(tenantThemeSettings.organizationId, context.organizationId))
      .limit(1);

    return {
      organizationId: context.organizationId,
      configured: Boolean(settings && tenantLocations.length > 0 && profiles.length > 0),
      settings: settings ?? null,
      locations: tenantLocations,
      profiles,
      modules,
      themes,
      themeSettings: themeSettings ?? null,
    };
  });
}
