import { z } from "zod";

export const locales = ["pt-PT", "pt-BR", "en", "es"] as const;
export type Locale = (typeof locales)[number];

export const tenantRoles = [
  "owner",
  "manager",
  "reception",
  "kitchen",
  "staff",
  "marketing",
  "accounting",
] as const;
export type TenantRole = (typeof tenantRoles)[number];

export const modules = [
  "core",
  "menu",
  "reservations",
  "events",
  "crm",
  "orders",
  "stock",
  "analytics",
  "ai",
  "multi_location",
  "loyalty",
] as const;
export type ModuleKey = (typeof modules)[number];

export const moduleStatusSchema = z.enum(["enabled", "disabled", "trial"]);

export const tenantContextSchema = z.object({
  organizationId: z.string().trim().min(1).max(255),
  userId: z.string().trim().min(1).max(255),
  role: z.enum(tenantRoles),
});
export type TenantContext = z.infer<typeof tenantContextSchema>;

export const restaurantOnboardingSchema = z.object({
  publicName: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).optional(),
  locationName: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  email: z.string().email().optional(),
  phone: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().max(24).optional(),
  city: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().length(2).default("PT"),
  timezone: z.string().trim().min(1).max(80).default("Europe/Lisbon"),
  currency: z.string().trim().length(3).default("EUR"),
  defaultLocale: z.enum(locales).default("pt-PT"),
  enabledLocales: z.array(z.enum(locales)).min(1).max(locales.length).default(["pt-PT", "en", "es"]),
});
export type RestaurantOnboardingInput = z.infer<typeof restaurantOnboardingSchema>;

export const reservationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
]);
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

export const createReservationSchema = z
  .object({
    locationId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    diningAreaId: z.string().uuid().optional(),
    tableId: z.string().uuid().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    partySize: z.number().int().min(1).max(100),
    guestName: z.string().trim().min(2).max(120),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const reservationListQuerySchema = z
  .object({
    locationId: z.string().uuid().optional(),
    status: reservationStatusSchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .refine((value) => !value.from || !value.to || value.to > value.from, {
    message: "to must be after from",
    path: ["to"],
  });
export type ReservationListQuery = z.infer<typeof reservationListQuerySchema>;

export const reservationIdParamsSchema = z.object({
  reservationId: z.string().uuid(),
});

export const updateReservationStatusSchema = z.object({
  status: reservationStatusSchema,
});
export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>;

const localizedContentSchema = z.object({
  locale: z.enum(locales),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
});

function hasUniqueLocales(value: Array<{ locale: Locale }>): boolean {
  return new Set(value.map((translation) => translation.locale)).size === value.length;
}

export const menuItemTranslationSchema = localizedContentSchema;
export const menuTranslationSchema = localizedContentSchema;
export const menuCategoryTranslationSchema = localizedContentSchema;

const translationsSchema = z
  .array(localizedContentSchema)
  .min(1)
  .max(locales.length)
  .refine(hasUniqueLocales, { message: "translations must contain unique locales" });

export const menuIdParamsSchema = z.object({ menuId: z.string().uuid() });
export const menuCategoryIdParamsSchema = z.object({ categoryId: z.string().uuid() });
export const menuItemIdParamsSchema = z.object({ menuItemId: z.string().uuid() });

export const createMenuSchema = z.object({
  locationId: z.string().uuid().nullable().optional(),
  internalName: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  translations: translationsSchema,
});
export type CreateMenuInput = z.infer<typeof createMenuSchema>;

export const updateMenuSchema = z
  .object({
    internalName: z.string().trim().min(2).max(160).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    isPublished: z.boolean().optional(),
    translations: translationsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "at least one field is required" });
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;

export const createMenuCategorySchema = z.object({
  menuId: z.string().uuid(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isVisible: z.boolean().default(true),
  translations: translationsSchema,
});
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  sku: z.string().trim().min(1).max(80).optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  imageUrl: z.string().url().max(2_048).optional(),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  allergenIds: z.array(z.string().uuid()).max(50).default([]),
  translations: translationsSchema,
});
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("mandys-api"),
  timestamp: z.string().datetime(),
});
