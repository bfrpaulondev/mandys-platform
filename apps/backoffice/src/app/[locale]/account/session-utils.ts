export function describeDevice(userAgent?: string | null) {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "Dispositivo desconhecido";

  const device = ua.includes("iphone") ? "iPhone" : ua.includes("ipad") ? "iPad" : ua.includes("android") ? "Android" : ua.includes("windows") ? "Windows" : ua.includes("macintosh") || ua.includes("mac os") ? "Mac" : ua.includes("linux") ? "Linux" : "Dispositivo";
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("opr/") || ua.includes("opera") ? "Opera" : ua.includes("firefox/") ? "Firefox" : ua.includes("chrome/") || ua.includes("crios/") ? "Chrome" : ua.includes("safari/") ? "Safari" : "Navegador";

  return `${device} · ${browser}`;
}

export function formatSessionDate(value: string | Date | undefined | null, locale: string) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
