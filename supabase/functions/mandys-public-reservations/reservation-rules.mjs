export function isValidCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isAlignedReservationSlot(startsAt, openAt, intervalMinutes) {
  const startsAtMs = startsAt instanceof Date ? startsAt.getTime() : Number.NaN;
  const openAtMs = openAt instanceof Date ? openAt.getTime() : Number.NaN;
  if (
    !Number.isFinite(startsAtMs) ||
    !Number.isFinite(openAtMs) ||
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes <= 0
  ) {
    return false;
  }

  const offsetMs = startsAtMs - openAtMs;
  return offsetMs >= 0 && offsetMs % (intervalMinutes * 60_000) === 0;
}
