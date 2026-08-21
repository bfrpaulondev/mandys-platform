import type { Locale } from "@mandys/contracts";
import { and, asc, eq, gte, isNotNull } from "drizzle-orm";

import { db } from "./client";
import {
  allergens,
  domains,
  locations,
  menuCategories,
  menuCategoryTranslations,
  menuItemAllergens,
  menuItems,
  menuItemTranslations,
  menus,
  menuTranslations,
  openingHours,
  restaurantProfiles,
  tenantSettings,
  tenantThemeSettings,
} from "./schema";
import { specialOpeningHours, zonedDateAndMinutes } from "./special-hours";
import { withTenant } from "./tenant";

const supportedLocales: Locale[] = ["pt-PT", "pt-BR", "en", "es"];

export class PublicStorefrontNotFoundError extends Error {
  constructor() {
    super("Restaurant storefront not found");
    this.name = "PublicStorefrontNotFoundError";
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!.split(":")[0]!;
}

function chooseLocale(
  requestedLocale: Locale,
  defaultLocale: Locale,
  enabledLocales: Locale[],
): Locale {
  if (enabledLocales.includes(requestedLocale)) return requestedLocale;
  if (enabledLocales.includes(defaultLocale)) return defaultLocale;
  return enabledLocales[0] ?? defaultLocale;
}

function translationFor<T extends { locale: Locale }>(
  rows: T[],
  locale: Locale,
  fallbackLocale: Locale,
): T | null {
  return (
    rows.find((row) => row.locale === locale) ??
    rows.find((row) => row.locale === fallbackLocale) ??
    rows[0] ??
    null
  );
}

export async function getPublicStorefrontByHostname(input: {
  hostname: string;
  locale: Locale;
}) {
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new PublicStorefrontNotFoundError();

  const [domain] = await db
    .select({ organizationId: domains.organizationId })
    .from(domains)
    .where(and(eq(domains.hostname, hostname), isNotNull(domains.verifiedAt)))
    .limit(1);

  if (!domain) throw new PublicStorefrontNotFoundError();

  return withTenant({ organizationId: domain.organizationId }, async (tx) => {
    const [settings] = await tx
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, domain.organizationId))
      .limit(1);

    if (!settings) throw new PublicStorefrontNotFoundError();

    const enabledLocales = settings.enabledLocales.filter((locale): locale is Locale =>
      supportedLocales.includes(locale),
    );
    const locale = chooseLocale(input.locale, settings.defaultLocale, enabledLocales);

    const [primaryDomain] = await tx
      .select({ hostname: domains.hostname })
      .from(domains)
      .where(
        and(
          eq(domains.organizationId, domain.organizationId),
          eq(domains.isPrimary, true),
          isNotNull(domains.verifiedAt),
        ),
      )
      .limit(1);

    const [location] = await tx
      .select()
      .from(locations)
      .where(and(eq(locations.organizationId, domain.organizationId), eq(locations.isActive, true)))
      .orderBy(asc(locations.createdAt))
      .limit(1);

    if (!location) throw new PublicStorefrontNotFoundError();

    const [profile] = await tx
      .select({
        publicName: restaurantProfiles.publicName,
        description: restaurantProfiles.description,
        logoUrl: restaurantProfiles.logoUrl,
        coverUrl: restaurantProfiles.coverUrl,
        contactEmail: restaurantProfiles.contactEmail,
        contactPhone: restaurantProfiles.contactPhone,
      })
      .from(restaurantProfiles)
      .where(
        and(
          eq(restaurantProfiles.organizationId, domain.organizationId),
          eq(restaurantProfiles.locationId, location.id),
        ),
      )
      .limit(1);

    if (!profile) throw new PublicStorefrontNotFoundError();

    const today = zonedDateAndMinutes(new Date(), settings.timezone).serviceDate;
    const [hours, specialHours, themeSettings, publishedMenus, allMenuTranslations, categories, allCategoryTranslations, items, allItemTranslations, allergenLinks, tenantAllergens] =
      await Promise.all([
        tx
          .select({
            weekday: openingHours.weekday,
            opensAt: openingHours.opensAt,
            closesAt: openingHours.closesAt,
            isClosed: openingHours.isClosed,
          })
          .from(openingHours)
          .where(
            and(
              eq(openingHours.organizationId, domain.organizationId),
              eq(openingHours.locationId, location.id),
            ),
          )
          .orderBy(asc(openingHours.weekday)),
        tx
          .select({
            serviceDate: specialOpeningHours.serviceDate,
            opensAt: specialOpeningHours.opensAt,
            closesAt: specialOpeningHours.closesAt,
            isClosed: specialOpeningHours.isClosed,
            label: specialOpeningHours.label,
          })
          .from(specialOpeningHours)
          .where(
            and(
              eq(specialOpeningHours.organizationId, domain.organizationId),
              eq(specialOpeningHours.locationId, location.id),
              gte(specialOpeningHours.serviceDate, today),
            ),
          )
          .orderBy(asc(specialOpeningHours.serviceDate))
          .limit(12),
        tx
          .select({ themeKey: tenantThemeSettings.themeKey, variant: tenantThemeSettings.variant, tokens: tenantThemeSettings.tokens })
          .from(tenantThemeSettings)
          .where(eq(tenantThemeSettings.organizationId, domain.organizationId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        tx
          .select({ id: menus.id, slug: menus.slug })
          .from(menus)
          .where(
            and(
              eq(menus.organizationId, domain.organizationId),
              eq(menus.isPublished, true),
            ),
          )
          .orderBy(asc(menus.createdAt)),
        tx
          .select({ menuId: menuTranslations.menuId, locale: menuTranslations.locale, name: menuTranslations.name, description: menuTranslations.description })
          .from(menuTranslations)
          .where(eq(menuTranslations.organizationId, domain.organizationId)),
        tx
          .select({ id: menuCategories.id, menuId: menuCategories.menuId, sortOrder: menuCategories.sortOrder })
          .from(menuCategories)
          .where(
            and(
              eq(menuCategories.organizationId, domain.organizationId),
              eq(menuCategories.isVisible, true),
            ),
          )
          .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.createdAt)),
        tx
          .select({ categoryId: menuCategoryTranslations.categoryId, locale: menuCategoryTranslations.locale, name: menuCategoryTranslations.name, description: menuCategoryTranslations.description })
          .from(menuCategoryTranslations)
          .where(eq(menuCategoryTranslations.organizationId, domain.organizationId)),
        tx
          .select({
            id: menuItems.id,
            categoryId: menuItems.categoryId,
            priceCents: menuItems.priceCents,
            imageUrl: menuItems.imageUrl,
            isFeatured: menuItems.isFeatured,
            sortOrder: menuItems.sortOrder,
          })
          .from(menuItems)
          .where(
            and(
              eq(menuItems.organizationId, domain.organizationId),
              eq(menuItems.isAvailable, true),
            ),
          )
          .orderBy(asc(menuItems.sortOrder), asc(menuItems.createdAt)),
        tx
          .select({ menuItemId: menuItemTranslations.menuItemId, locale: menuItemTranslations.locale, name: menuItemTranslations.name, description: menuItemTranslations.description })
          .from(menuItemTranslations)
          .where(eq(menuItemTranslations.organizationId, domain.organizationId)),
        tx
          .select({ menuItemId: menuItemAllergens.menuItemId, allergenId: menuItemAllergens.allergenId })
          .from(menuItemAllergens)
          .where(eq(menuItemAllergens.organizationId, domain.organizationId)),
        tx
          .select({ id: allergens.id, code: allergens.code, name: allergens.name })
          .from(allergens)
          .where(eq(allergens.organizationId, domain.organizationId))
          .orderBy(asc(allergens.name)),
      ]);

    const publicMenus = publishedMenus.map((menu) => {
      const translation = translationFor(
        allMenuTranslations.filter((row) => row.menuId === menu.id),
        locale,
        settings.defaultLocale,
      );

      return {
        id: menu.id,
        slug: menu.slug,
        name: translation?.name ?? menu.slug,
        description: translation?.description ?? null,
        categories: categories
          .filter((category) => category.menuId === menu.id)
          .map((category) => {
            const categoryTranslation = translationFor(
              allCategoryTranslations.filter((row) => row.categoryId === category.id),
              locale,
              settings.defaultLocale,
            );

            return {
              id: category.id,
              name: categoryTranslation?.name ?? "",
              description: categoryTranslation?.description ?? null,
              items: items
                .filter((item) => item.categoryId === category.id)
                .map((item) => {
                  const itemTranslation = translationFor(
                    allItemTranslations.filter((row) => row.menuItemId === item.id),
                    locale,
                    settings.defaultLocale,
                  );
                  const linkedAllergenIds = allergenLinks
                    .filter((row) => row.menuItemId === item.id)
                    .map((row) => row.allergenId);

                  return {
                    id: item.id,
                    name: itemTranslation?.name ?? "",
                    description: itemTranslation?.description ?? null,
                    priceCents: item.priceCents,
                    imageUrl: item.imageUrl,
                    isFeatured: item.isFeatured,
                    allergens: tenantAllergens.filter((allergen) => linkedAllergenIds.includes(allergen.id)),
                  };
                }),
            };
          }),
      };
    });

    return {
      locale,
      defaultLocale: settings.defaultLocale,
      enabledLocales,
      currency: settings.currency,
      timezone: settings.timezone,
      canonicalHostname: primaryDomain?.hostname ?? hostname,
      restaurant: profile,
      location: {
        name: location.name,
        addressLine1: location.addressLine1,
        addressLine2: location.addressLine2,
        postalCode: location.postalCode,
        city: location.city,
        countryCode: location.countryCode,
        phone: location.phone,
        email: location.email,
      },
      openingHours: hours,
      specialOpeningHours: specialHours,
      theme: themeSettings ?? { themeKey: "minimal", variant: "light", tokens: {} },
      menus: publicMenus,
    };
  });
}
