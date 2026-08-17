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
    if (response.status() >= 500) failures.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return failures;
}

async function gotoRendered(page, url) {
  let response = null;
  try {
    response = await page.goto(url, { waitUntil: "commit", timeout: 20_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("ERR_ABORTED") && !message.includes("frame was detached")) throw error;
  }
  if (response) expect(response.status(), `${url} returned a server error`).toBeLessThan(500);
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

async function expectReservationAvailabilitySettled(page) {
  const timeSelect = page.getByTestId("reservation-starts-at");
  await expect(timeSelect).toBeVisible();
  await expect
    .poll(
      async () => {
        const placeholder = await timeSelect.locator("option").first().textContent();
        return placeholder?.trim() ?? "";
      },
      { timeout: 15_000 },
    )
    .not.toMatch(/A procurar horários|Buscando horários|Finding available times|Buscando horarios/i);

  const optionCount = await timeSelect.locator("option").count();
  if (optionCount > 1) {
    await expect(timeSelect).toBeEnabled();
    await timeSelect.selectOption({ index: 1 });
    await expect(page.getByTestId("reservation-submit")).toBeEnabled();
    return;
  }

  await expect(timeSelect).toBeDisabled();
  await expect(
    page
      .getByTestId("storefront-reservation-form")
      .getByText(/Não existem horários|Não há horários|There are no available times|No hay horarios/i),
  ).toBeVisible();
}

for (const [locale, localeLabel, bookingTitle, bookingCta] of locales) {
  test(`Storefront ${locale} renders the live localized reservation surface`, async ({ page }) => {
    const runtimeFailures = watchRuntime(page);
    const response = await page.goto(`${storefrontOrigin}/${locale}`, { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText(liveMarker, { exact: false }).first()).toBeVisible();
    await expect(page.locator("summary").filter({ hasText: localeLabel })).toHaveText(localeLabel);
    await expect(page.getByRole("heading", { name: bookingTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: bookingCta, exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("storefront-reservation-form")).toBeVisible();
    await expect(page.getByText("Mandy's Reserve", { exact: true })).toBeVisible();
    expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
  });
}

test("Storefront reservation availability gateway returns the live policy contract", async ({ request }) => {
  const response = await request.get(
    `${storefrontOrigin}/api/reservations?date=${encodeURIComponent(futureDateValue())}&partySize=2`,
    { headers: { accept: "application/json" } },
  );
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = await response.json();
  expect(body?.data?.timezone).toBeTruthy();
  expect(Number.isInteger(body?.data?.durationMinutes)).toBeTruthy();
  expect([15, 30, 60]).toContain(body?.data?.intervalMinutes);
  expect(Number.isInteger(body?.data?.minimumNoticeMinutes)).toBeTruthy();
  expect(Number.isInteger(body?.data?.maximumAdvanceDays)).toBeTruthy();
  expect(body?.data?.maximumAdvanceDays).toBeGreaterThan(0);
  expect(Number.isInteger(body?.data?.maximumPartySize)).toBeTruthy();
  expect(body?.data?.maximumPartySize).toBeGreaterThan(0);
  expect(typeof body?.data?.waitlistEnabled).toBe("boolean");
  expect(Array.isArray(body?.data?.slots)).toBeTruthy();
  expect(body?.error).toBeUndefined();
});

test("Storefront reservation gateway rejects impossible calendar dates without a server error", async ({ request }) => {
  const response = await request.get(`${storefrontOrigin}/api/reservations?date=2026-02-30&partySize=2`, {
    headers: { accept: "application/json" },
  });
  expect(response.status()).toBe(400);
  expect((await response.json())?.error).toBe("INVALID_QUERY");
});

test("Storefront waitlist gateway requires a contact method without mutating data", async ({ request }) => {
  const response = await request.post(`${storefrontOrigin}/api/reservations/waitlist`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: {
      requestedDate: futureDateValue(),
      partySize: 2,
      locale: "en",
      guestName: "Readiness Probe",
    },
  });
  expect(response.status()).toBe(400);
  expect((await response.json())?.error).toBe("CONTACT_REQUIRED");
});

for (const [viewportName, viewport] of responsiveViewports) {
  test(`Storefront reservation surface is usable without horizontal overflow on ${viewportName}`, async ({ page }) => {
    const runtimeFailures = watchRuntime(page);
    await page.setViewportSize(viewport);
    const response = await page.goto(`${storefrontOrigin}/pt-PT`, { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    await page.getByRole("link", { name: "Reservar mesa", exact: true }).first().click();
    await expect(page.getByTestId("storefront-reservation-form")).toBeVisible();
    await expect(page.getByTestId("reservation-guest-name")).toBeVisible();
    await expect(page.getByTestId("reservation-party-size")).toBeVisible();
    await expect(page.getByTestId("reservation-date")).toBeVisible();
    await expect(page.getByTestId("reservation-starts-at")).toBeVisible();
    await expect(page.getByTestId("reservation-submit")).toBeVisible();
    await expectReservationAvailabilitySettled(page);
    await expectNoHorizontalOverflow(page);
    expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
  });
}

test("Backoffice login renders a real interactive authentication surface", async ({ page }) => {
  const runtimeFailures = watchRuntime(page);
  await gotoRendered(page, `${backofficeOrigin}/en/login`);
  await expect(page.getByText("Mandy's Backoffice", { exact: true })).toBeVisible({ timeout: 15_000 });
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
    await gotoRendered(page, `${backofficeOrigin}/en/login`);
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to Mandy's", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
  });
}
