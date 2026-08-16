import { z } from "zod";

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
  organizationId: z.string().uuid(),
  userId: z.string().min(1),
  role: z.enum(tenantRoles),
});
export type TenantContext = z.infer<typeof tenantContextSchema>;

export const reservationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
]);
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

export const createReservationSchema = z.object({
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
});
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const menuItemTranslationSchema = z.object({
  locale: z.enum(["pt-PT", "pt-BR", "en", "es"]),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("mandys-api"),
  timestamp: z.string().datetime(),
});
