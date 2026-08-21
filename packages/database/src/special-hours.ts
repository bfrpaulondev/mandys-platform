import { boolean, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { locations } from "./schema";

export const specialOpeningHours = pgTable(
  "special_opening_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    serviceDate: date("service_date", { mode: "string" }).notNull(),
    opensAt: text("opens_at"),
    closesAt: text("closes_at"),
    isClosed: boolean("is_closed").default(false).notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("special_opening_hours_location_date_uidx").on(table.locationId, table.serviceDate),
    index("special_opening_hours_org_location_date_idx").on(
      table.organizationId,
      table.locationId,
      table.serviceDate,
    ),
  ],
);

export type OpeningWindow = {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function reservationFitsOpeningWindow(
  startMinutes: number,
  endMinutes: number,
  window: OpeningWindow,
): boolean {
  if (window.isClosed || !window.opensAt || !window.closesAt) return false;
  const opens = timeToMinutes(window.opensAt);
  const closesRaw = timeToMinutes(window.closesAt);
  if (opens === null || closesRaw === null || startMinutes < 0 || endMinutes < 0) return false;

  const overnight = closesRaw <= opens;
  const closes = overnight ? closesRaw + 24 * 60 : closesRaw;
  const normalizedStart = overnight && startMinutes < opens ? startMinutes + 24 * 60 : startMinutes;
  const normalizedEnd = overnight && endMinutes <= normalizedStart ? endMinutes + 24 * 60 : endMinutes;
  return normalizedStart >= opens && normalizedEnd > normalizedStart && normalizedEnd <= closes;
}

export function zonedDateAndMinutes(value: Date, timezone: string): { serviceDate: string; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Could not resolve local restaurant time");
  }
  return { serviceDate: `${year}-${month}-${day}`, minutes: hour * 60 + minute };
}
