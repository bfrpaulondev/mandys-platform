import { z } from "zod";

export const locales = ["pt-PT", "pt-BR", "en", "es"] as const;
export type Locale = (typeof locales)[number];

const isoCountryCodes = new Set([
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
]);

export function isSupportedCountryCode(value: string): boolean {
  return isoCountryCodes.has(value.trim().toUpperCase());
}

export function isSupportedCurrencyCode(value: string): boolean {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return false;
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf !== "function") return true;
  return intl.supportedValuesOf("currency").includes(currency);
}

export function isValidIanaTimezone(value: string): boolean {
  const timezone = value.trim();
  if (!timezone || timezone.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

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

export const restaurantOnboardingSchema = z
  .object({
    publicName: z.string().trim().min(2).max(160),
    legalName: z.string().trim().max(200).optional(),
    locationName: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(40).optional(),
    addressLine1: z.string().trim().max(200).optional(),
    addressLine2: z.string().trim().max(200).optional(),
    postalCode: z.string().trim().max(24).optional(),
    city: z.string().trim().max(120).optional(),
    countryCode: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine(isSupportedCountryCode, { message: "countryCode must be a valid ISO 3166-1 alpha-2 code" })
      .default("PT"),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(isValidIanaTimezone, { message: "timezone must be a valid IANA timezone" })
      .default("Europe/Lisbon"),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine(isSupportedCurrencyCode, { message: "currency must be a supported ISO 4217 code" })
      .default("EUR"),
    defaultLocale: z.enum(locales).default("pt-PT"),
    enabledLocales: z
      .array(z.enum(locales))
      .min(1)
      .max(locales.length)
      .refine((value) => new Set(value).size === value.length, { message: "enabledLocales must contain unique locales" })
      .default(["pt-PT", "en", "es"]),
  })
  .superRefine((value, context) => {
    if (!value.enabledLocales.includes(value.defaultLocale)) {
      context.addIssue({
        code: "custom",
        path: ["defaultLocale"],
        message: "defaultLocale must be included in enabledLocales",
      });
    }
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

export const eventLeadStatusSchema = z.enum([
  "new",
  "contacted",
  "proposal_sent",
  "deposit_pending",
  "confirmed",
  "completed",
  "lost",
]);
export type EventLeadStatus = z.infer<typeof eventLeadStatusSchema>;

export const createEventLeadSchema = z
  .object({
    locationId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    eventType: z.string().trim().min(2).max(120),
    contactName: z.string().trim().min(2).max(160),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().trim().max(40).optional(),
    eventAt: z.coerce.date().optional(),
    partySize: z.number().int().min(1).max(10_000).optional(),
    budgetMinCents: z.number().int().min(0).max(100_000_000).optional(),
    budgetMaxCents: z.number().int().min(0).max(100_000_000).optional(),
    notes: z.string().trim().max(4_000).optional(),
  })
  .refine(
    (value) =>
      value.budgetMinCents === undefined ||
      value.budgetMaxCents === undefined ||
      value.budgetMaxCents >= value.budgetMinCents,
    { message: "budgetMaxCents must be greater than or equal to budgetMinCents", path: ["budgetMaxCents"] },
  );
export type CreateEventLeadInput = z.infer<typeof createEventLeadSchema>;

export const eventLeadListQuerySchema = z.object({
  status: eventLeadStatusSchema.optional(),
  locationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type EventLeadListQuery = z.infer<typeof eventLeadListQuerySchema>;

export const eventLeadIdParamsSchema = z.object({ eventLeadId: z.string().uuid() });

export const updateEventLeadStatusSchema = z.object({ status: eventLeadStatusSchema });
export type UpdateEventLeadStatusInput = z.infer<typeof updateEventLeadStatusSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("mandys-api"),
  timestamp: z.string().datetime(),
});