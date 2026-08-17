import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

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

async function signIn(page, email, password) {
  await gotoRendered(page, `${backofficeOrigin}/en/login`);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to Mandy's", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
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
    // Keep identity and tenant provisioning on the real same-origin gateways. This
    // avoids a Next.js hydration navigation race while still exercising the exact
    // Better Auth + onboarding contracts used by the browser UI.
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
    expect((await sessionResponse.json())?.user?.email).toBe(email);

    const organizationResponse = await page.request.post(
      `${backofficeOrigin}/api/auth/organization/create`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: { name: restaurantName, slug: `mandys-${restaurantSlug}` },
      },
    );
    expect(
      organizationResponse.ok(),
      `organization create returned ${organizationResponse.status()}: ${await organizationResponse.text()}`,
    ).toBeTruthy();
    const organizationBody = await organizationResponse.json();
    const organizationId =
      organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
    expect(typeof organizationId).toBe("string");
    tenantCreated = true;

    const activeResponse = await page.request.post(
      `${backofficeOrigin}/api/auth/organization/set-active`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: { organizationId },
      },
    );
    expect(activeResponse.ok(), `set-active returned ${activeResponse.status()}`).toBeTruthy();

    const onboardingResponse = await page.request.post(
      `${backofficeOrigin}/api/runtime/v1/onboarding/restaurant`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: {
          publicName: restaurantName,
          locationName: "Principal",
          slug: restaurantSlug,
          countryCode: "PT",
          timezone: "Europe/Lisbon",
          currency: "EUR",
          defaultLocale: "en",
          enabledLocales: ["en", "es"],
        },
      },
    );
    expect(
      onboardingResponse.ok(),
      `restaurant onboarding returned ${onboardingResponse.status()}: ${await onboardingResponse.text()}`,
    ).toBeTruthy();

    await gotoRendered(page, `${backofficeOrigin}/en`);
    await expect(page.getByRole("navigation", { name: "Mandy's" })).toBeVisible({ timeout: 20_000 });
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
      await gotoRendered(page, `${backofficeOrigin}/en/${path}`);
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
      expect(page.url(), `${path} unexpectedly lost the authenticated session`).not.toContain("/login");
    }

    const initialRetentionResponse = await page.request.get(
      `${backofficeOrigin}/api/retention/v1/retention`,
      { headers: { accept: "application/json" } },
    );
    expect(initialRetentionResponse.ok()).toBeTruthy();
    expect((await initialRetentionResponse.json())?.data).toEqual({
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

    // Regional prices are private commercial drafts. The customer-facing billing
    // contract must remain unpriced until explicit publication + checkout approval.
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
    expect((await tenantDeleteResponse.json())?.data?.deleted).toBe(true);
    tenantCreated = false;

    const accountDeleteResponse = await deleteUser(page, password);
    expect(accountDeleteResponse.ok()).toBeTruthy();
    userCreated = false;

    await gotoRendered(page, `${backofficeOrigin}/en/login`);
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
        // Best-effort cleanup. Post-run database checks catch any E2E leftovers.
      }
    }
  }
});
