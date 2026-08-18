import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";

const locales = ["pt-PT", "pt-BR", "en", "es"];
const reservationCtas = [
  ["pt-PT", "Reservar mesa"],
  ["pt-BR", "Reservar mesa"],
  ["en", "Book a table"],
  ["es", "Reservar mesa"],
];
const responsiveViewports = [
  ["mobile", { width: 390, height: 844 }],
  ["tablet", { width: 768, height: 1024 }],
  ["desktop", { width: 1440, height: 900 }],
];

function expectSameOrigin(actualUrl, expectedOrigin) {
  expect(new URL(actualUrl).origin).toBe(new URL(expectedOrigin).origin);
}

async function expectNoHorizontalOverflow(page) {
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual(
      expect.objectContaining({
        viewportWidth: expect.any(Number),
        documentWidth: expect.any(Number),
      }),
    );

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

for (const locale of locales) {
  test(`Backoffice ${locale} browser entry stays on the configured Netlify origin`, async ({ page }) => {
    const response = await page.goto(`${backofficeOrigin}/${locale}/login`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    expectSameOrigin(page.url(), backofficeOrigin);
  });

  test(`Backoffice ${locale} protected entry returns unauthenticated users to the locale login on origin`, async ({ page }) => {
    const response = await page.goto(`${backofficeOrigin}/${locale}/reservations`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page).toHaveURL(`${backofficeOrigin}/${locale}/login`, { timeout: 15_000 });
    expectSameOrigin(page.url(), backofficeOrigin);
  });
}

test("Backoffice auth session gateway stays on the configured Netlify origin", async ({ request }) => {
  const response = await request.get(`${backofficeOrigin}/api/auth/get-session`, {
    headers: { accept: "application/json" },
    maxRedirects: 10,
  });

  expect(response.status()).toBeLessThan(500);
  expect(response.headers()["content-type"] ?? "").toContain("application/json");
  expectSameOrigin(response.url(), backofficeOrigin);
});

test("Backoffice protected runtime gateway rejects missing tenant context on the configured Netlify origin", async ({ request }) => {
  const response = await request.get(`${backofficeOrigin}/api/runtime/v1/core`, {
    headers: { accept: "application/json" },
    maxRedirects: 10,
  });

  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"] ?? "").toContain("application/json");
  expectSameOrigin(response.url(), backofficeOrigin);

  const body = await response.json();
  expect(["UNAUTHORIZED", "TENANT_CONTEXT_REQUIRED"]).toContain(body?.error);
});

test("Backoffice dashboard gateway is served by the Netlify edge proxy and rejects unauthenticated access", async ({ request }) => {
  const response = await request.get(`${backofficeOrigin}/api/dashboard`, {
    headers: { accept: "application/json" },
    maxRedirects: 10,
  });

  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"] ?? "").toContain("application/json");
  expect(response.headers()["x-mandys-proxy"]).toBe("netlify-edge");
  expect(response.headers()["cache-control"] ?? "").toContain("no-store");
  expectSameOrigin(response.url(), backofficeOrigin);

  const body = await response.json();
  expect(body?.error).toBe("UNAUTHENTICATED");
});

test("Storefront browser entry stays on the configured Netlify origin", async ({ page }) => {
  const response = await page.goto(`${storefrontOrigin}/pt-PT`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.ok()).toBeTruthy();
  expectSameOrigin(page.url(), storefrontOrigin);
});

for (const [viewportName, viewport] of responsiveViewports) {
  test(`Backoffice login is usable without horizontal overflow on ${viewportName}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const response = await page.goto(`${backofficeOrigin}/en/login`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    expectSameOrigin(page.url(), backofficeOrigin);
    await expect(page.locator("input").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test(`Storefront menu and reservation flow stay usable without horizontal overflow on ${viewportName}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const response = await page.goto(`${storefrontOrigin}/pt-PT#menu`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    expectSameOrigin(page.url(), storefrontOrigin);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Reservar mesa", exact: true }).first().click();
    await expect(page.getByTestId("storefront-reservation-form")).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#reserve");
    await expectNoHorizontalOverflow(page);
  });
}

for (const [locale, bookingCta] of reservationCtas) {
  test(`Storefront ${locale} menu to reservation CTA stays on origin and reaches the live form`, async ({ page }) => {
    const response = await page.goto(`${storefrontOrigin}/${locale}#menu`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    expectSameOrigin(page.url(), storefrontOrigin);

    await page.getByRole("link", { name: bookingCta, exact: true }).first().click();
    await expect(page.getByTestId("storefront-reservation-form")).toBeVisible();
    expectSameOrigin(page.url(), storefrontOrigin);
    expect(new URL(page.url()).hash).toBe("#reserve");
  });
}

test("Storefront reservation API stays on the configured Netlify origin", async ({ request }) => {
  const response = await request.get(`${storefrontOrigin}/api/reservations?date=2099-01-01&partySize=2`, {
    headers: { accept: "application/json" },
    maxRedirects: 10,
  });

  expect(response.status()).toBeLessThan(500);
  expectSameOrigin(response.url(), storefrontOrigin);
});
