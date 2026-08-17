#!/usr/bin/env node

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";
const storefrontLiveMarker =
  process.env.MANDYS_STOREFRONT_LIVE_MARKER ?? "Maré · Setúbal";
const storefrontFallbackMarker = "Maré · Demonstração Mandy's";

const storefrontLocales = [
  ["pt-PT", "Português (Portugal)"],
  ["pt-BR", "Português (Brasil)"],
  ["en", "English"],
  ["es", "Español"],
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
    requiredText: ["ok"],
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
  ...storefrontLocales.map(([locale, localeLabel]) => ({
    name: `Storefront ${locale}`,
    url: `${storefrontOrigin}/${locale}`,
    requiredText: ["Mandy", localeLabel, storefrontLiveMarker],
    forbiddenText: [storefrontFallbackMarker],
  })),
  {
    name: "Storefront reservation availability gateway",
    url: `${storefrontOrigin}/api/reservations?date=${encodeURIComponent(reservationProbeDate)}&partySize=2`,
    requiredText: [],
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
      headers: { "user-agent": "mandys-v0.1-readiness-check/1.2" },
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
    failures.push({ name: target.name, error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${target.name}: ${error instanceof Error ? error.message : String(error)}`);
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
  "\nPublic deployment smoke checks passed with a DB-backed Storefront and live reservation availability gateway. Browser E2E is still required before V0.1 is declared ready.",
);
