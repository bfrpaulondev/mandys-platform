function calendarParts(timeZone: string, value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function restaurantDateInputValue(
  timeZone: string,
  offsetDays = 0,
  now = new Date(),
) {
  const { year, month, day } = calendarParts(timeZone, now);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function createReservationTimeFormatter(locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}
