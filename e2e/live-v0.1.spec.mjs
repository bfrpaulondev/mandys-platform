import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";
const liveMarker = process.env.MANDYS_STOREFRONT_LIVE_MARKER ?? "Maré · Setúbal";

const locales = [
  ["pt-PT", "Português (Portugal)", "Reserve diretamente", "Reservar mesa"],
  ["pt-BR", "Português (Brasil)", "Reserve diretamente", "Reservar mesa"],
  ["en", "English", "Book directly", "Book a table"],
  ["es", "Español", "Reserva directamente", "Reservar mesa"],
];

const responsiveViewports = [
  ["mobile", { width: 390, height: 844 }],
  ["tablet", { width: 768, height: 1024 }],
  ["desktop", { width: 1440, height: 900 }],
];

function futureDateValue(offsetDays = 2) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function watchRuntime(page) {
  const failures = [];

  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console.error: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      failures.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  return failures;
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    overflow.scrollWidth,
    `horizontal overflow detected: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

for (const [locale, localeLabel, bookingTitle, bookingCta] of locales) {
  test(`Storefront ${locale} renders the live localized reservation surface`, async ({ page }) => {
    const runtimeFailures = watchRuntime(page);

    const response = await page.goto(`${storefrontOrigin}/${locale}`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText(liveMarker, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(localeLabel, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: bookingTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: bookingCta, exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("storefront-reservation-form")).toBeVisible();
    await expect(page.getByText("Mandy's Reserve", { exact: true })).toBeVisible();

    expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
  });
}

test("Storefront reservation availability gateway returns live structured data", async ({ request }) => {
  const response = await request.get(
    `${storefrontOrigin}/api/reservations?date=${encodeURIComponent(futureDateValue())}&partySize=2`,
    { headers: { accept: "application/json" } },
  );

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/json");

  const body = await response.json();
  expect(body?.data?.timezone).toBeTruthy();
  expect(Array.isArray(body?.data?.slots)).toBeTruthy();
  expect(body?.error).toBeUndefined();
});

for (const [viewportName, viewport] of responsiveViewports) {
  test(`Storefront reservation surface is usable without horizontal overflow on ${viewportName}`, async ({ page }) => {
    const runtimeFailures = watchRuntime(page);
    await page.setViewportSize(viewport);

    const response = await page.goto(`${storefrontOrigin}/pt-PT`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    await page.getByRole("link", { name: "Reservar mesa", exact: true }).first().click();
    await expect(page.getByTestId("storefront-reservation-form")).toBeVisible();
    await expect(page.getByTestId("reservation-guest-name")).toBeVisible();
    await expect(page.getByTestId("reservation-party-size")).toBeVisible();
    await expect(page.getByTestId("reservation-date")).toBeVisible();
    await expect(page.getByTestId("reservation-starts-at")).toBeVisible();
    await expect(page.getByTestId("reservation-submit")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
  });
}

test("Backoffice login renders a real interactive authentication surface", async ({ page }) => {
  const runtimeFailures = watchRuntime(page);

  const response = await page.goto(`${backofficeOrigin}/en/login`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText("Mandy's Backoffice", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run your restaurant from one place." })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to Mandy's", exact: true })).toBeVisible();

  expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
});

for (const [viewportName, viewport] of responsiveViewports) {
  test(`Backoffice login remains usable without horizontal overflow on ${viewportName}`, async ({ page }) => {
    const runtimeFailures = watchRuntime(page);
    await page.setViewportSize(viewport);

    const response = await page.goto(`${backofficeOrigin}/en/login`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to Mandy's", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
  });
}
