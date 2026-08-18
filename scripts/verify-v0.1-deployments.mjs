#!/usr/bin/env node

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";
const storefrontLiveMarker =
  process.env.MANDYS_STOREFRONT_LIVE_MARKER ?? "Maré · Setúbal";
const storefrontFallbackMarker = "Maré · Demonstração Mandy's";
const backofficeReadinessVersion =
  process.env.MANDYS_BACKOFFICE_READINESS_VERSION ?? "authenticated-lifecycle-v1";
const reservationProbeTimezone =
  process.env.MANDYS_RESERVATION_PROBE_TIMEZONE ?? "Europe/Lisbon";

const backofficeLocales = ["pt-PT", "pt-BR", "en", "es"];
const storefrontLocales = [
  ["pt-PT", "Português (Portugal)", "Reserve diretamente", "Reservar mesa"],
  ["pt-BR", "Português (Brasil)", "Reserve diretamente", "Reservar mesa"],
  ["en", "English", "Book directly", "Book a table"],
  ["es", "Español", "Reserva directamente", "Reservar mesa"],
];

const transientStatuses = new Set([408, 429, 502, 503, 504]);
const maxAttempts = 3;
const requestTimeoutMs = 15_000;

function datePartsInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function futureDateValue(offsetDays = 2, timeZone = reservationProbeTimezone) {
  const { year, month, day } = datePartsInTimezone(new Date(), timeZone);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTransientRetry(target) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(target.url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "mandys-v0.1-readiness-check/1.8" },
      });

      if (!transientStatuses.has(response.status) || attempt === maxAttempts) {
        return { response, attempt };
      }

      await response.body?.cancel();
      console.warn(
        `RETRY ${target.name}: HTTP ${response.status} on attempt ${attempt}/${maxAttempts}`,
      );
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
      console.warn(
        `RETRY ${target.name}: ${error instanceof Error ? error.message : String(error)} on attempt ${attempt}/${maxAttempts}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    await sleep(500 * attempt);
  }

  throw lastError ?? new Error(`Unable to fetch ${target.url}`);
}

const reservationProbeDate =
  process.env.MANDYS_RESERVATION_PROBE_DATE ?? futureDateValue();

const targets = [
  ...backofficeLocales.map((locale) => ({
    name: `Backoffice ${locale} login`,
    url:
      locale === "en" && process.env.MANDYS_BACKOFFICE_URL
        ? process.env.MANDYS_BACKOFFICE_URL
        : `${backofficeOrigin}/${locale}/login`,
    requiredText: ["Mandy"],
  })),
  {
    name: "Backoffice protected reservations route",
    url: `${backofficeOrigin}/en/reservations`,
    requiredText: ["Mandy"],
  },
  {
    name: "Backoffice health",
    url: `${backofficeOrigin}/api/health`,
    requiredText: ["ok", backofficeReadinessVersion],
  },
  {
    name: "Backoffice auth gateway",
    url: `${backofficeOrigin}/api/auth/get-session`,
    requiredText: [],
    requiredContentType: "application/json",
  },
  {
    name: "Backoffice PWA manifest",
    url: `${backofficeOrigin}/manifest.webmanifest`,
    requiredText: ["Mandy", "standalone"],
    requiredContentType: "application/manifest+json",
  },
  ...storefrontLocales.map(([locale, localeLabel, bookingTitle, bookingCta]) => ({
    name: `Storefront ${locale}`,
    url: `${storefrontOrigin}/${locale}`,
    requiredText: [
      "Mandy",
      localeLabel,
      storefrontLiveMarker,
      bookingTitle,
      bookingCta,
      "Mandy's Reserve",
    ],
    forbiddenText: [storefrontFallbackMarker],
  })),
  {
    name: "Storefront reservation availability gateway",
    url: `${storefrontOrigin}/api/reservations?date=${encodeURIComponent(reservationProbeDate)}&partySize=2`,
    requiredText: [
      '"timezone"',
      '"durationMinutes"',
      '"intervalMinutes"',
      '"minimumNoticeMinutes"',
      '"maximumAdvanceDays"',
      '"maximumPartySize"',
      '"waitlistEnabled"',
      '"slots"',
    ],
    forbiddenText: [
      "HOST_UNAVAILABLE",
      "API_UNAVAILABLE",
      "UPSTREAM_ERROR",
      "Restaurant hostname could not be resolved",
      "Availability service is temporarily unavailable",
    ],
    requiredContentType: "application/json",
  },
];

const failures = [];

for (const target of targets) {
  try {
    const { response, attempt } = await fetchWithTransientRetry(target);
    const body = await response.text();
    const normalizedBody = body.toLocaleLowerCase();
    const contentType = response.headers.get("content-type") ?? "";
    const missing = target.requiredText.filter(
      (text) => !normalizedBody.includes(text.toLocaleLowerCase()),
    );
    const forbidden = (target.forbiddenText ?? []).filter((text) =>
      normalizedBody.includes(text.toLocaleLowerCase()),
    );
    const contentTypeMismatch =
      target.requiredContentType !== undefined &&
      !contentType.toLocaleLowerCase().includes(target.requiredContentType.toLocaleLowerCase());
    const expectedOrigin = new URL(target.url).origin;
    const finalOrigin = new URL(response.url).origin;
    const originMismatch = finalOrigin !== expectedOrigin;

    if (
      !response.ok ||
      missing.length > 0 ||
      forbidden.length > 0 ||
      contentTypeMismatch ||
      originMismatch
    ) {
      failures.push({
        name: target.name,
        status: response.status,
        finalUrl: response.url,
        attempts: attempt,
        missing,
        forbidden,
        ...(contentTypeMismatch
          ? { expectedContentType: target.requiredContentType, actualContentType: contentType }
          : {}),
        ...(originMismatch ? { expectedOrigin, finalOrigin } : {}),
      });
      console.error(`FAIL ${target.name}: ${response.status} ${response.url}`);
      continue;
    }

    console.log(
      `PASS ${target.name}: ${response.status} ${response.url}${attempt > 1 ? ` after ${attempt} attempts` : ""}`,
    );
  } catch (error) {
    failures.push({
      name: target.name,
      attempts: maxAttempts,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(
      `FAIL ${target.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nMandy's V0.1 deployment readiness check failed:");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log(
  "\nPublic deployment smoke checks passed with localized Backoffice entrypoints, protected Backoffice routing, the required Backoffice readiness version, a DB-backed Storefront, localized reservation surface, live reservation policy contract and origin-stable Netlify routing. Browser E2E is still required before V0.1 is declared ready.",
);
