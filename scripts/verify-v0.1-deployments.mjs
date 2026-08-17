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

const storefrontLocales = [
  ["pt-PT", "Português (Portugal)", "Reserve diretamente", "Reservar mesa"],
  ["pt-BR", "Português (Brasil)", "Reserve diretamente", "Reservar mesa"],
  ["en", "English", "Book directly", "Book a table"],
  ["es", "Español", "Reserva directamente", "Reservar mesa"],
];

function futureDateValue(offsetDays = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const reservationProbeDate =
  process.env.MANDYS_RESERVATION_PROBE_DATE ?? futureDateValue();

const targets = [
  {
    name: "Backoffice login",
    url: process.env.MANDYS_BACKOFFICE_URL ?? `${backofficeOrigin}/en/login`,
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "mandys-v0.1-readiness-check/1.5" },
    });
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

    if (!response.ok || missing.length > 0 || forbidden.length > 0 || contentTypeMismatch) {
      failures.push({
        name: target.name,
        status: response.status,
        finalUrl: response.url,
        missing,
        forbidden,
        ...(contentTypeMismatch
          ? { expectedContentType: target.requiredContentType, actualContentType: contentType }
          : {}),
      });
      console.error(`FAIL ${target.name}: ${response.status} ${response.url}`);
      continue;
    }

    console.log(`PASS ${target.name}: ${response.status} ${response.url}`);
  } catch (error) {
    failures.push({
      name: target.name,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(
      `FAIL ${target.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

if (failures.length > 0) {
  console.error("\nMandy's V0.1 deployment readiness check failed:");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log(
  "\nPublic deployment smoke checks passed with the required Backoffice readiness version, a DB-backed Storefront, localized reservation surface and live reservation policy contract. Browser E2E is still required before V0.1 is declared ready.",
);
