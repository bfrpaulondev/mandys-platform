import assert from "node:assert/strict";

import {
  isAlignedReservationSlot,
  isValidCalendarDate,
} from "../supabase/functions/mandys-public-reservations/reservation-rules.mjs";

assert.equal(isValidCalendarDate("2026-08-17"), true);
assert.equal(isValidCalendarDate("2028-02-29"), true);
assert.equal(isValidCalendarDate("2026-02-29"), false);
assert.equal(isValidCalendarDate("2026-02-30"), false);
assert.equal(isValidCalendarDate("2026-99-99"), false);
assert.equal(isValidCalendarDate("17-08-2026"), false);

const openAt = new Date("2026-08-17T17:15:00.000Z");
assert.equal(isAlignedReservationSlot(openAt, openAt, 30), true);
assert.equal(
  isAlignedReservationSlot(new Date("2026-08-17T17:45:00.000Z"), openAt, 30),
  true,
);
assert.equal(
  isAlignedReservationSlot(new Date("2026-08-17T18:15:00.000Z"), openAt, 30),
  true,
);
assert.equal(
  isAlignedReservationSlot(new Date("2026-08-17T17:30:00.000Z"), openAt, 30),
  false,
);
assert.equal(
  isAlignedReservationSlot(new Date("2026-08-17T17:45:30.000Z"), openAt, 30),
  false,
);

console.log("Validated public reservation calendar and slot-alignment rules.");
