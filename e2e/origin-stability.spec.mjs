import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";

function expectSameOrigin(actualUrl, expectedOrigin) {
  expect(new URL(actualUrl).origin).toBe(new URL(expectedOrigin).origin);
}

test("Backoffice browser entry stays on the configured Netlify origin", async ({ page }) => {
  const response = await page.goto(`${backofficeOrigin}/en/login`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.ok()).toBeTruthy();
  expectSameOrigin(page.url(), backofficeOrigin);
});

test("Storefront browser entry stays on the configured Netlify origin", async ({ page }) => {
  const response = await page.goto(`${storefrontOrigin}/pt-PT`, {
    waitUntil: "domcontentloaded",
  });

  expect(response?.ok()).toBeTruthy();
  expectSameOrigin(page.url(), storefrontOrigin);
});

test("Storefront reservation API stays on the configured Netlify origin", async ({ request }) => {
  const response = await request.get(`${storefrontOrigin}/api/reservations?date=2099-01-01&partySize=2`, {
    headers: { accept: "application/json" },
    maxRedirects: 10,
  });

  expect(response.status()).toBeLessThan(500);
  expectSameOrigin(response.url(), storefrontOrigin);
});
