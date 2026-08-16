import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const localeCode = pgEnum("locale_code", ["pt-PT", "pt-BR", "en", "es"]);
export const entitlementStatus = pgEnum("entitlement_status", ["enabled", "disabled", "trial"]);
export const reservationStatus = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
]);
export const eventLeadStatus = pgEnum("event_lead_status", [
  "new",
  "contacted",
  "proposal_sent",
  "deposit_pending",
  "confirmed",
  "completed",
  "lost",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const tenantSettings = pgTable(
  "tenant_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    defaultLocale: localeCode("default_locale").default("pt-PT").notNull(),
    enabledLocales: jsonb("enabled_locales")
      .$type<Array<"pt-PT" | "pt-BR" | "en" | "es">>()
      .default(["pt-PT", "en", "es"])
      .notNull(),
    timezone: text("timezone").default("Europe/Lisbon").notNull(),
    currency: text("currency").default("EUR").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tenant_settings_organization_uidx").on(table.organizationId)],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    email: text("email"),
    phone: text("phone"),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    postalCode: text("postal_code"),
    city: text("city"),
    countryCode: text("country_code").default("PT").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("locations_org_slug_uidx").on(table.organizationId, table.slug),
    index("locations_org_idx").on(table.organizationId),
  ],
);

export const restaurantProfiles = pgTable(
  "restaurant_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "cascade" }),
    publicName: text("public_name").notNull(),
    legalName: text("legal_name"),
    description: text("description"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    reservationDurationMinutes: integer("reservation_duration_minutes").default(90).notNull(),
    ...timestamps,
  },
  (table) => [index("restaurant_profiles_org_idx").on(table.organizationId)],
);

export const openingHours = pgTable(
  "opening_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    opensAt: text("opens_at"),
    closesAt: text("closes_at"),
    isClosed: boolean("is_closed").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("opening_hours_location_weekday_uidx").on(table.locationId, table.weekday),
    index("opening_hours_org_location_idx").on(table.organizationId, table.locationId),
  ],
);

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    hostname: text("hostname").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("domains_hostname_uidx").on(table.hostname),
    index("domains_org_idx").on(table.organizationId),
  ],
);

export const moduleEntitlements = pgTable(
  "module_entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    moduleKey: text("module_key").notNull(),
    status: entitlementStatus("status").default("disabled").notNull(),
    plan: text("plan"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("module_entitlements_org_module_uidx").on(table.organizationId, table.moduleKey),
  ],
);

export const themeEntitlements = pgTable(
  "theme_entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    themeKey: text("theme_key").notNull(),
    status: entitlementStatus("status").default("disabled").notNull(),
    licenseType: text("license_type").default("included").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("theme_entitlements_org_theme_uidx").on(table.organizationId, table.themeKey)],
);

export const tenantThemeSettings = pgTable(
  "tenant_theme_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    themeKey: text("theme_key").default("minimal").notNull(),
    variant: text("variant").default("light").notNull(),
    tokens: jsonb("tokens").$type<Record<string, string | number>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tenant_theme_settings_org_uidx").on(table.organizationId)],
);

export const menus = pgTable(
  "menus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "cascade" }),
    internalName: text("internal_name").notNull(),
    slug: text("slug").notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("menus_org_slug_uidx").on(table.organizationId, table.slug),
    index("menus_org_location_idx").on(table.organizationId, table.locationId),
  ],
);

export const menuTranslations = pgTable(
  "menu_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    locale: localeCode("locale").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("menu_translations_menu_locale_uidx").on(table.menuId, table.locale),
    index("menu_translations_org_idx").on(table.organizationId),
  ],
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("menu_categories_org_menu_idx").on(table.organizationId, table.menuId)],
);

export const menuCategoryTranslations = pgTable(
  "menu_category_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    locale: localeCode("locale").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [uniqueIndex("menu_category_translations_locale_uidx").on(table.categoryId, table.locale)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    sku: text("sku"),
    priceCents: integer("price_cents").notNull(),
    imageUrl: text("image_url"),
    isAvailable: boolean("is_available").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    index("menu_items_org_category_idx").on(table.organizationId, table.categoryId),
    uniqueIndex("menu_items_org_sku_uidx").on(table.organizationId, table.sku),
  ],
);

export const menuItemTranslations = pgTable(
  "menu_item_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    locale: localeCode("locale").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("menu_item_translations_item_locale_uidx").on(table.menuItemId, table.locale),
    index("menu_item_translations_org_idx").on(table.organizationId),
  ],
);

export const allergens = pgTable(
  "allergens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("allergens_org_code_uidx").on(table.organizationId, table.code)],
);

export const menuItemAllergens = pgTable(
  "menu_item_allergens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    allergenId: uuid("allergen_id")
      .notNull()
      .references(() => allergens.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [uniqueIndex("menu_item_allergens_uidx").on(table.menuItemId, table.allergenId)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    preferredLocale: localeCode("preferred_locale"),
    notes: text("notes"),
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    marketingConsentSource: text("marketing_consent_source"),
    ...timestamps,
  },
  (table) => [
    index("customers_org_email_idx").on(table.organizationId, table.email),
    index("customers_org_phone_idx").on(table.organizationId, table.phone),
  ],
);

export const diningAreas = pgTable(
  "dining_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("dining_areas_org_location_idx").on(table.organizationId, table.locationId)],
);

export const restaurantTables = pgTable(
  "restaurant_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    diningAreaId: uuid("dining_area_id")
      .notNull()
      .references(() => diningAreas.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minSeats: integer("min_seats").default(1).notNull(),
    maxSeats: integer("max_seats").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("restaurant_tables_area_name_uidx").on(table.diningAreaId, table.name),
    index("restaurant_tables_org_location_idx").on(table.organizationId, table.locationId),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    diningAreaId: uuid("dining_area_id").references(() => diningAreas.id, { onDelete: "set null" }),
    tableId: uuid("table_id").references(() => restaurantTables.id, { onDelete: "set null" }),
    guestName: text("guest_name").notNull(),
    guestEmail: text("guest_email"),
    guestPhone: text("guest_phone"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    partySize: integer("party_size").notNull(),
    status: reservationStatus("status").default("pending").notNull(),
    notes: text("notes"),
    source: text("source").default("direct").notNull(),
    ...timestamps,
  },
  (table) => [
    index("reservations_org_start_idx").on(table.organizationId, table.startsAt),
    index("reservations_org_location_start_idx").on(table.organizationId, table.locationId, table.startsAt),
    index("reservations_org_status_start_idx").on(table.organizationId, table.status, table.startsAt),
  ],
);

export const eventLeads = pgTable(
  "event_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: eventLeadStatus("status").default("new").notNull(),
    eventType: text("event_type").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    eventAt: timestamp("event_at", { withTimezone: true }),
    partySize: integer("party_size"),
    budgetMinCents: integer("budget_min_cents"),
    budgetMaxCents: integer("budget_max_cents"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("event_leads_org_status_idx").on(table.organizationId, table.status),
    index("event_leads_org_event_idx").on(table.organizationId, table.eventAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    requestId: text("request_id"),
    ipHash: text("ip_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_logs_org_entity_idx").on(table.organizationId, table.entityType, table.entityId),
  ],
);
