import { expect, test } from "@playwright/test";

// This file deliberately intercepts the Orders API to verify optimistic UI updates.
// A production service worker can answer the request before Playwright routing sees it,
// so block service workers only for this performance spec. PWA behavior remains covered
// by the rest of the live suite with the default service-worker setting.
test.use({ serviceWorkers: "block" });

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function uniqueIdentity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-perf2-${token}@example.com`,
    password: `Mandy-E2E-Perf2-${token}!Aa9`,
    restaurantName: `Mandy PERF2 ${token}`,
    restaurantSlug: `mandy-perf2-${token}`.toLowerCase(),
  };
}

async function retryRequest(label, operation, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await operation();
      if (response.status() < 500 || attempt === attempts) return response;
      lastError = new Error(`${label} returned ${response.status()}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    await sleep(300 * 2 ** (attempt - 1));
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function provisionTenant(page, identity) {
  const signup = await retryRequest("signup", () => page.request.post(
    `${backofficeOrigin}/api/auth/sign-up/email`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: "Mandy Performance 2", email: identity.email, password: identity.password },
    },
  ));
  expect(signup.ok(), `signup returned ${signup.status()}: ${await signup.text()}`).toBeTruthy();

  const organization = await retryRequest("organization", () => page.request.post(
    `${backofficeOrigin}/api/auth/organization/create`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: identity.restaurantName, slug: `mandys-${identity.restaurantSlug}` },
    },
  ));
  expect(organization.ok(), `organization returned ${organization.status()}: ${await organization.text()}`).toBeTruthy();
  const organizationBody = await organization.json();
  const organizationId = organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
  expect(typeof organizationId).toBe("string");

  const active = await retryRequest("set active", () => page.request.post(
    `${backofficeOrigin}/api/auth/organization/set-active`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { organizationId },
    },
  ));
  expect(active.ok(), `set active returned ${active.status()}: ${await active.text()}`).toBeTruthy();

  const onboarding = await retryRequest("onboarding", () => page.request.post(
    `${backofficeOrigin}/api/runtime/v1/onboarding/restaurant`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: {
        publicName: identity.restaurantName,
        locationName: "Principal",
        slug: identity.restaurantSlug,
        countryCode: "PT",
        timezone: "Europe/Lisbon",
        currency: "EUR",
        defaultLocale: "en",
        enabledLocales: ["en", "pt-PT"],
      },
    },
  ));
  expect(onboarding.ok(), `onboarding returned ${onboarding.status()}: ${await onboarding.text()}`).toBeTruthy();
}

async function cleanup(page, identity) {
  const tenant = await retryRequest("tenant cleanup", () => page.request.delete(
    `${backofficeOrigin}/api/data-protection/v1/tenant`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { confirmation: "DELETE" },
    },
  ));
  if (!tenant.ok() && tenant.status() !== 401) {
    throw new Error(`tenant cleanup returned ${tenant.status()}: ${await tenant.text()}`);
  }

  const user = await retryRequest("user cleanup", () => page.request.post(
    `${backofficeOrigin}/api/auth/delete-user`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { password: identity.password },
    },
  ));
  if (!user.ok() && user.status() !== 401) {
    throw new Error(`user cleanup returned ${user.status()}: ${await user.text()}`);
  }
}

async function assertOperationalEdge(response, label, { allowModuleDisabled = false } = {}) {
  expect(response.headers()["x-mandys-proxy"], `${label} did not use Netlify Edge`).toBe("netlify-edge");
  expect(response.headers()["server-timing"] ?? "", `${label} lacks Edge timing`).toContain("mandys_netlify_edge");

  if (response.ok()) return;
  const body = await response.json().catch(() => ({}));
  const expectedDisabled = allowModuleDisabled
    && response.status() === 403
    && (
      body?.error === "MODULE_DISABLED"
      || (label === "orders" && body?.error === "ORDERS_DISABLED")
      || (label === "stock" && body?.error === "STOCK_DISABLED")
    );
  expect(
    expectedDisabled,
    `${label} returned ${response.status()}: ${JSON.stringify(body)}`,
  ).toBeTruthy();
}

test("performance sprint 6-10 is active on production", async ({ page }) => {
  test.setTimeout(240_000);
  const identity = uniqueIdentity();
  let provisioned = false;

  try {
    await provisionTenant(page, identity);
    provisioned = true;

    const now = new Date();
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
    const operationalReads = [
      ["menu", "/api/menu/v1/menu", false],
      ["reservations", `/api/reservations/v1/reservations?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}&limit=20`, false],
      ["crm", "/api/crm/v1/customers", false],
      // Orders and Stock are optional entitlements for a freshly onboarded tenant.
      // Their gateways are healthy if they reach the runtime and preserve the exact
      // fail-closed disabled response, or return 200 when the module is enabled.
      ["orders", "/api/orders/v1/orders?limit=20", true],
      ["stock", "/api/stock/v1/stock", true],
      ["notifications", "/api/notifications/v1/notifications?limit=20", false],
    ];

    for (const [label, path, allowModuleDisabled] of operationalReads) {
      const response = await retryRequest(label, () => page.request.get(`${backofficeOrigin}${path}`, {
        headers: { accept: "application/json" },
      }));
      await assertOperationalEdge(response, label, { allowModuleDisabled });
    }

    const contextRequests = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== backofficeOrigin) return;
      if (url.pathname === "/api/dashboard" || url.pathname === "/api/runtime/v1/core") {
        contextRequests.push(url.pathname);
      }
    });

    await page.goto(`${backofficeOrigin}/en/customers`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("navigation", { name: "Mandy's" })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => contextRequests.includes("/api/dashboard"), { timeout: 10_000 }).toBe(true);
    expect(contextRequests).not.toContain("/api/runtime/v1/core");

    await page.goto(`${backofficeOrigin}/en`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("navigation", { name: "Mandy's" })).toBeVisible({ timeout: 20_000 });

    const warmResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === backofficeOrigin && url.pathname === "/api/menu/v1/menu" && response.request().method() === "GET";
    }, { timeout: 20_000 });
    await page.getByRole("link", { name: "Menu", exact: true }).hover();
    const warmed = await warmResponse;
    await assertOperationalEdge(warmed, "menu prefetch");

    const cacheState = await page.evaluate(async () => {
      const response = await fetch("/api/menu/v1/menu", { credentials: "include" });
      return response.headers.get("x-mandys-client-cache");
    });
    expect(cacheState).toBe("hit");

    const fakeOrder = {
      id: "optimistic-order",
      orderNumber: 9001,
      status: "pending",
      fulfillmentType: "pickup",
      paymentMethod: "pay_at_pickup",
      currency: "EUR",
      subtotalCents: 1200,
      totalCents: 1200,
      scheduledFor: null,
      guestName: "Optimistic Guest",
      guestEmail: null,
      guestPhone: null,
      notes: null,
      source: "e2e",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [{
        id: "optimistic-item",
        menuItemId: null,
        itemName: "Performance item",
        unitPriceCents: 1200,
        quantity: 1,
        lineTotalCents: 1200,
        notes: null,
      }],
    };

    await page.route("**/api/orders/v1/orders?limit=200", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [fakeOrder] }),
      });
    });
    await page.route("**/api/orders/v1/orders/optimistic-order/status", async (route) => {
      const body = route.request().postDataJSON();
      await sleep(1_000);
      if (body?.status === "preparing") {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "forced optimistic rollback" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ...fakeOrder, status: body?.status } }) });
    });

    await page.goto(`${backofficeOrigin}/en/orders`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByText("Optimistic Guest", { exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.getByText("Accepted", { exact: true })).toBeVisible({ timeout: 400 });
    await expect(page.getByRole("button", { name: "Start preparing", exact: true })).toBeVisible({ timeout: 3_000 });

    await page.getByRole("button", { name: "Start preparing", exact: true }).click();
    await expect(page.getByText("Preparing", { exact: true })).toBeVisible({ timeout: 400 });
    await expect(page.getByText("Accepted", { exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("forced optimistic rollback", { exact: true })).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    if (provisioned) await cleanup(page, identity);
  }
});
