import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";

test("Backoffice deployment exposes the expected readiness identity", async ({ request }) => {
  const response = await request.get(`${backofficeOrigin}/api/health`, {
    headers: { accept: "application/json" },
  });

  expect(response.ok(), `health returned ${response.status()}: ${await response.text()}`).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = await response.json();
  expect(body).toEqual({
    service: "mandys-backoffice",
    status: "ok",
    readinessVersion: "authenticated-lifecycle-v1",
  });
});

test("Netlify targets do not redirect across Mandy applications", async ({ request }) => {
  const backoffice = await request.get(`${backofficeOrigin}/en/login`, { maxRedirects: 0 });
  expect(backoffice.status()).toBeLessThan(500);
  if (backoffice.status() >= 300 && backoffice.status() < 400) {
    const location = backoffice.headers().location;
    expect(location, "backoffice redirect is missing Location").toBeTruthy();
    expect(new URL(location, backofficeOrigin).origin).toBe(new URL(backofficeOrigin).origin);
  }

  const storefront = await request.get(`${storefrontOrigin}/pt-PT`, { maxRedirects: 0 });
  expect(storefront.status()).toBeLessThan(500);
  if (storefront.status() >= 300 && storefront.status() < 400) {
    const location = storefront.headers().location;
    expect(location, "storefront redirect is missing Location").toBeTruthy();
    expect(new URL(location, storefrontOrigin).origin).toBe(new URL(storefrontOrigin).origin);
  }
});
