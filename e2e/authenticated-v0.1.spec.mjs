import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function pathIs(url, expected) {
  return url.pathname.replace(/\/+$/, "") === expected;
}

async function signIn(page, email, password) {
  await page.goto(`${backofficeOrigin}/en/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to Mandy's", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

async function deleteUser(page, password) {
  return page.request.post(`${backofficeOrigin}/api/auth/delete-user`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { password },
  });
}

async function deleteTenant(page) {
  return page.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { confirmation: "DELETE" },
  });
}

test("Backoffice disposable owner can onboard, exercise private policy, export and cleanly delete the tenant", async ({ page }) => {
  test.setTimeout(150_000);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `mandys-e2e-${unique}@example.com`;
  const password = `Mandy-E2E-${unique}!Aa9`;
  const restaurantName = `Mandy E2E ${unique}`;
  const restaurantSlug = `mandy-e2e-${unique}`.toLowerCase();
  let userCreated = false;
  let tenantCreated = false;

  try {
    const loginResponse = await page.goto(`${backofficeOrigin}/en/login`, {
      waitUntil: "domcontentloaded",
    });
    expect(loginResponse?.ok()).toBeTruthy();

    const signupResponse = await page.request.post(
      `${backofficeOrigin}/api/auth/sign-up/email`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: { name: "Mandy E2E Owner", email, password },
      },
    );
    expect(signupResponse.ok(), `signup returned ${signupResponse.status()}`).toBeTruthy();
    userCreated = true;

    const sessionResponse = await page.request.get(`${backofficeOrigin}/api/auth/get-session`, {
      headers: { accept: "application/json" },
    });
    expect(sessionResponse.ok()).toBeTruthy();
    const sessionBody = await sessionResponse.json();
    expect(sessionBody?.user?.email).toBe(email);

    // After the request-context signup the browser can race the app's auth redirect.
    // Resolve as soon as navigation commits and let the rendered onboarding form be
    // the readiness signal instead of waiting on DOMContentLoaded for a frame that
    // may be replaced by Next.js during session hydration.
    const onboardingPage = await page.goto(`${backofficeOrigin}/en/onboarding`, {
      waitUntil: "commit",
    });
    expect(onboardingPage?.status(), "onboarding returned a server error").toBeLessThan(500);
    await expect(page.getByLabel("Restaurant public name", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel("Restaurant public name", { exact: true }).fill(restaurantName);
    await page.locator('input[name="slug"]').fill(restaurantSlug);
    await page.getByLabel("Country (ISO 2)", { exact: true }).fill("PT");
    await page.getByLabel("Currency (ISO 3)", { exact: true }).fill("EUR");
    await page.getByLabel("Timezone", { exact: true }).fill("Europe/Lisbon");

    const organizationResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/auth/organization/create"),
      { timeout: 20_000 },
    );
    const onboardingResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/runtime/v1/onboarding/restaurant"),
      { timeout: 25_000 },
    );
    await page.getByRole("button", { name: "Create restaurant", exact: true }).click();

    const organizationResponse = await organizationResponsePromise;
    expect(
      organizationResponse.ok(),
      `organization create returned ${organizationResponse.status()}: ${await organizationResponse.text()}`,
    ).toBeTruthy();
    tenantCreated = true;

    const onboardingResponse = await onboardingResponsePromise;
    expect(
      onboardingResponse.ok(),
      `restaurant onboarding returned ${onboardingResponse.status()}: ${await onboardingResponse.text()}`,
    ).toBeTruthy();

    await page.waitForURL((url) => pathIs(url, "/en"), { timeout: 20_000 });
    await expect(page.getByRole("navigation", { name: "Mandy's" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reservations", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Menu", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Data", exact: true })).toBeVisible();

    const privatePaths = [
      "profile",
      "settings",
      "menu",
      "reservations",
      "events",
      "customers",
      "orders",
      "stock",
      "insights",
      "notifications",
      "team",
      "activity",
      "billing",
      "data",
    ];
    for (const path of privatePaths) {
      const response = await page.goto(`${backofficeOrigin}/en/${path}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${path} returned a server error`).toBeLessThan(500);
      await page.waitForTimeout(150);
      expect(page.url(), `${path} unexpectedly lost the authenticated session`).not.toContain("/login");
    }

    // Retention policy is owner-only, tenant-scoped and starts explicitly disabled.
    const initialRetentionResponse = await page.request.get(
      `${backofficeOrigin}/api/retention/v1/retention`,
      { headers: { accept: "application/json" } },
    );
    expect(initialRetentionResponse.ok()).toBeTruthy();
    const initialRetention = await initialRetentionResponse.json();
    expect(initialRetention?.data).toEqual({
      customerDataRetentionDays: null,
      auditLogRetentionDays: null,
      notificationRetentionDays: null,
    });

    const invalidRetentionResponse = await page.request.put(
      `${backofficeOrigin}/api/retention/v1/retention`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: {
          customerDataRetentionDays: 29,
          auditLogRetentionDays: null,
          notificationRetentionDays: null,
        },
      },
    );
    expect(invalidRetentionResponse.status()).toBe(400);
    expect((await invalidRetentionResponse.json())?.error).toBe("INVALID_RETENTION_POLICY");

    const expectedRetention = {
      customerDataRetentionDays: 365,
      auditLogRetentionDays: 730,
      notificationRetentionDays: 90,
    };
    const updateRetentionResponse = await page.request.put(
      `${backofficeOrigin}/api/retention/v1/retention`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: expectedRetention,
      },
    );
    expect(updateRetentionResponse.ok()).toBeTruthy();
    expect((await updateRetentionResponse.json())?.data).toEqual(expectedRetention);

    const readbackRetentionResponse = await page.request.get(
      `${backofficeOrigin}/api/retention/v1/retention`,
      { headers: { accept: "application/json" } },
    );
    expect(readbackRetentionResponse.ok()).toBeTruthy();
    expect((await readbackRetentionResponse.json())?.data).toEqual(expectedRetention);

    // Regional price proposals live in a separate private table. Until commercial
    // approval, the customer-facing billing contract must continue to expose no price.
    const billingResponse = await page.request.get(`${backofficeOrigin}/api/billing/v1/billing`, {
      headers: { accept: "application/json" },
    });
    expect(billingResponse.ok()).toBeTruthy();
    const billing = await billingResponse.json();
    expect(billing?.data?.plans?.length).toBeGreaterThanOrEqual(5);
    for (const plan of billing.data.plans) {
      expect(plan.monthlyPriceCents).toBeNull();
      expect(plan.annualPriceCents).toBeNull();
    }

    const protectedAccountDelete = await deleteUser(page, password);
    expect(protectedAccountDelete.status()).toBe(400);

    const exportResponse = await page.request.get(
      `${backofficeOrigin}/api/data-protection/v1/export`,
      { headers: { accept: "application/json" } },
    );
    expect(exportResponse.ok()).toBeTruthy();
    const exported = await exportResponse.json();
    expect(exported?.format).toBe("mandys-tenant-export-v1");
    expect(exported?.organization?.name).toBe(restaurantName);
    expect(exported?.team?.members?.length).toBeGreaterThanOrEqual(1);

    const tenantDeleteResponse = await deleteTenant(page);
    expect(tenantDeleteResponse.ok()).toBeTruthy();
    const tenantDeleteBody = await tenantDeleteResponse.json();
    expect(tenantDeleteBody?.data?.deleted).toBe(true);
    tenantCreated = false;

    const accountDeleteResponse = await deleteUser(page, password);
    expect(accountDeleteResponse.ok()).toBeTruthy();
    userCreated = false;

    await page.goto(`${backofficeOrigin}/en/login`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Sign in to Mandy's", exact: true })).toBeVisible();
  } finally {
    if (userCreated) {
      try {
        const session = await page.request.get(`${backofficeOrigin}/api/auth/get-session`, {
          headers: { accept: "application/json" },
        });
        if (!session.ok() || (await session.text()) === "null") {
          await signIn(page, email, password);
        }
        if (tenantCreated) {
          const cleanupTenant = await deleteTenant(page);
          if (cleanupTenant.ok()) tenantCreated = false;
        }
        const cleanupUser = await deleteUser(page, password);
        if (cleanupUser.ok()) userCreated = false;
      } catch {
        // Best-effort cleanup. CI additionally checks for orphaned E2E identities.
      }
    }
  }
});
