import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
const storefrontOrigin =
  process.env.MANDYS_STOREFRONT_ORIGIN ?? "https://mandy-store-front.netlify.app";

function uniqueIdentity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-perf-${token}@example.com`,
    password: `Mandy-E2E-Perf-${token}!Aa9`,
    restaurantName: `Mandy E2E PERF ${token}`,
    restaurantSlug: `mandy-e2e-perf-${token}`.toLowerCase(),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    await sleep(250 * 2 ** (attempt - 1));
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function provisionTenant(page, identity) {
  const signup = await retryRequest("signup", () => page.request.post(`${backofficeOrigin}/api/auth/sign-up/email`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { name: "Mandy Performance E2E", email: identity.email, password: identity.password },
  }));
  expect(signup.ok(), `signup returned ${signup.status()}: ${await signup.text()}`).toBeTruthy();

  const organization = await retryRequest("organization create", () => page.request.post(`${backofficeOrigin}/api/auth/organization/create`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { name: identity.restaurantName, slug: `mandys-${identity.restaurantSlug}` },
  }));
  expect(organization.ok(), `organization returned ${organization.status()}: ${await organization.text()}`).toBeTruthy();
  const organizationBody = await organization.json();
  const organizationId = organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
  expect(typeof organizationId).toBe("string");

  const active = await retryRequest("set active organization", () => page.request.post(`${backofficeOrigin}/api/auth/organization/set-active`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { organizationId },
  }));
  expect(active.ok(), `set-active returned ${active.status()}: ${await active.text()}`).toBeTruthy();

  const onboarding = await retryRequest("onboarding", () => page.request.post(`${backofficeOrigin}/api/runtime/v1/onboarding/restaurant`, {
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
  }));
  expect(onboarding.ok(), `onboarding returned ${onboarding.status()}: ${await onboarding.text()}`).toBeTruthy();
}

async function cleanup(page, identity) {
  const tenant = await retryRequest("tenant cleanup", () => page.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { confirmation: "DELETE" },
  }));
  if (!tenant.ok() && tenant.status() !== 401) {
    throw new Error(`tenant cleanup returned ${tenant.status()}: ${await tenant.text()}`);
  }

  const user = await retryRequest("user cleanup", () => page.request.post(`${backofficeOrigin}/api/auth/delete-user`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { password: identity.password },
  }));
  if (!user.ok() && user.status() !== 401) {
    throw new Error(`user cleanup returned ${user.status()}: ${await user.text()}`);
  }
}

function expectTimingHeader(response, required) {
  const value = response.headers()["server-timing"] ?? "";
  for (const marker of required) expect(value, `missing ${marker} in Server-Timing: ${value}`).toContain(marker);
}

test("Storefront remains DB-backed and stable across repeated reads", async ({ request }) => {
  test.setTimeout(60_000);
  for (const locale of ["pt-PT", "pt-BR", "en", "es"]) {
    const firstStart = Date.now();
    const first = await retryRequest(`storefront ${locale} first`, () => request.get(`${storefrontOrigin}/${locale}`));
    const firstMs = Date.now() - firstStart;
    expect(first.ok(), `${locale} first load returned ${first.status()}`).toBeTruthy();
    const firstBody = await first.text();
    expect(firstBody).toContain("Maré");

    const secondStart = Date.now();
    const second = await retryRequest(`storefront ${locale} repeat`, () => request.get(`${storefrontOrigin}/${locale}`));
    const secondMs = Date.now() - secondStart;
    expect(second.ok(), `${locale} repeat load returned ${second.status()}`).toBeTruthy();
    expect(await second.text()).toContain("Maré");
    expect(secondMs, `${locale} repeat storefront read regressed`).toBeLessThan(1_500);
    console.log(`PERF storefront ${locale}: first=${firstMs}ms repeat=${secondMs}ms`);
  }
});

test("Dashboard uses one bootstrap request and exposes end-to-end timing", async ({ page }) => {
  test.setTimeout(180_000);
  const identity = uniqueIdentity();
  let provisioned = false;
  try {
    await provisionTenant(page, identity);
    provisioned = true;

    const apiStartedAt = Date.now();
    const dashboardApi = await retryRequest("dashboard API", () => page.request.get(`${backofficeOrigin}/api/dashboard`, {
      headers: { accept: "application/json" },
    }));
    const dashboardApiMs = Date.now() - apiStartedAt;
    const timing = dashboardApi.headers()["server-timing"] ?? "";
    console.log(`PERF dashboard response proxy=${dashboardApi.headers()["x-mandys-proxy"] ?? "none"} timing=${timing}`);
    expect(dashboardApi.ok(), `dashboard API returned ${dashboardApi.status()}: ${await dashboardApi.text()}`).toBeTruthy();
    expect(dashboardApi.headers()["x-mandys-proxy"]).toBe("netlify-edge");
    expectTimingHeader(dashboardApi, ["mandys_auth", "mandys_member", "mandys_db", "mandys_edge", "mandys_netlify_edge"]);
    expect(timing).not.toContain("mandys_gateway");
    const body = await dashboardApi.json();
    expect(body?.data?.configured).toBe(true);
    expect(body?.data?.profile?.publicName).toBe(identity.restaurantName);
    expect(body?.data?.today?.reservationCount).toBe(0);
    expect(dashboardApiMs, `dashboard API is too slow: ${dashboardApiMs}ms`).toBeLessThan(3_000);

    const dashboardRequests = [];
    const legacyCoreRequests = [];
    const legacyReservationRequests = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== backofficeOrigin) return;
      if (url.pathname === "/api/dashboard") dashboardRequests.push(url.href);
      if (url.pathname === "/api/runtime/v1/core") legacyCoreRequests.push(url.href);
      if (url.pathname.startsWith("/api/runtime/v1/reservations")) legacyReservationRequests.push(url.href);
    });

    const startedAt = Date.now();
    await page.goto(`${backofficeOrigin}/en`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: identity.restaurantName })).toBeVisible({ timeout: 25_000 });
    const visibleMs = Date.now() - startedAt;
    console.log(`PERF dashboard api=${dashboardApiMs}ms visible=${visibleMs}ms`);

    expect(visibleMs, `Dashboard should become usable under 4s, got ${visibleMs}ms`).toBeLessThan(4_000);
    expect(dashboardRequests.length, "Dashboard should use one bootstrap request").toBe(1);
    expect(legacyCoreRequests, "Dashboard must not waterfall through legacy core").toHaveLength(0);
    expect(legacyReservationRequests, "Dashboard must not separately load reservations").toHaveLength(0);
  } finally {
    if (provisioned) await cleanup(page, identity);
  }
});

test("Backoffice memory cache serves repeat reads and invalidates after mutations", async ({ page }) => {
  test.setTimeout(240_000);
  const identity = uniqueIdentity();
  let provisioned = false;
  try {
    await provisionTenant(page, identity);
    provisioned = true;

    await page.goto(`${backofficeOrigin}/en`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: identity.restaurantName })).toBeVisible({ timeout: 25_000 });

    const cacheStates = await page.evaluate(async () => {
      await fetch("/api/menu/v1/menu", { credentials: "include", cache: "reload" });
      const first = await fetch("/api/menu/v1/menu", { credentials: "include" });
      const second = await fetch("/api/menu/v1/menu", { credentials: "include" });
      return {
        first: first.headers.get("x-mandys-client-cache"),
        second: second.headers.get("x-mandys-client-cache"),
        timing: first.headers.get("server-timing"),
      };
    });
    expect(["miss", "deduped"], "first read must not be a stale cache hit").toContain(cacheStates.first);
    expect(cacheStates.second).toBe("hit");
    expect(cacheStates.timing ?? "").toContain("mandys_gateway");

    const uniqueSlug = `perf-${Date.now().toString(36)}`;
    const mutationStates = await page.evaluate(async (slug) => {
      const create = await fetch("/api/menu/v1/menu", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          internalName: "Performance cache test",
          slug,
          translations: [{ locale: "en", name: "Performance cache test" }],
        }),
      });
      const createBody = await create.json();
      const afterMutation = await fetch("/api/menu/v1/menu", { credentials: "include" });
      const repeat = await fetch("/api/menu/v1/menu", { credentials: "include" });
      return {
        createOk: create.ok,
        createStatus: create.status,
        createBody,
        afterMutation: afterMutation.headers.get("x-mandys-client-cache"),
        repeat: repeat.headers.get("x-mandys-client-cache"),
      };
    }, uniqueSlug);

    expect(mutationStates.createOk, `menu create returned ${mutationStates.createStatus}`).toBeTruthy();
    expect(["miss", "deduped"], "mutation must invalidate any stale menu cache hit").toContain(mutationStates.afterMutation);
    expect(mutationStates.repeat).toBe("hit");
  } finally {
    if (provisioned) await cleanup(page, identity);
  }
});
