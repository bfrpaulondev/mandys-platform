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

async function deleteUser(pageOrContext, password) {
  return pageOrContext.request.post(`${backofficeOrigin}/api/auth/delete-user`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { password },
  });
}

async function deleteTenant(pageOrContext) {
  return pageOrContext.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { confirmation: "DELETE" },
  });
}

function uniqueIdentity(prefix = "owner") {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-${prefix}-${token}@example.com`,
    password: `Mandy-E2E-${prefix}-${token}!Aa9`,
    restaurantName: `Mandy E2E ${prefix.toUpperCase()} ${token}`,
    restaurantSlug: `mandy-e2e-${prefix}-${token}`.toLowerCase(),
  };
}

async function provisionTenant(pageOrContext, identity) {
  const signup = await pageOrContext.request.post(
    `${backofficeOrigin}/api/auth/sign-up/email`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: {
        name: `Mandy E2E ${identity.restaurantSlug}`,
        email: identity.email,
        password: identity.password,
      },
    },
  );
  expect(signup.ok(), `signup returned ${signup.status()}: ${await signup.text()}`).toBeTruthy();

  const organization = await pageOrContext.request.post(
    `${backofficeOrigin}/api/auth/organization/create`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: identity.restaurantName, slug: `mandys-${identity.restaurantSlug}` },
    },
  );
  expect(
    organization.ok(),
    `organization create returned ${organization.status()}: ${await organization.text()}`,
  ).toBeTruthy();
  const organizationBody = await organization.json();
  const organizationId =
    organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
  expect(typeof organizationId).toBe("string");

  const active = await pageOrContext.request.post(
    `${backofficeOrigin}/api/auth/organization/set-active`,
    {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { organizationId },
    },
  );
  expect(active.ok(), `set-active returned ${active.status()}: ${await active.text()}`).toBeTruthy();

  const onboarding = await pageOrContext.request.post(
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
        enabledLocales: ["en"],
      },
    },
  );
  expect(
    onboarding.ok(),
    `restaurant onboarding returned ${onboarding.status()}: ${await onboarding.text()}`,
  ).toBeTruthy();

  return organizationId;
}

async function cleanupTenantAndUser(pageOrContext, identity) {
  const tenant = await deleteTenant(pageOrContext);
  if (!tenant.ok() && tenant.status() !== 401) {
    throw new Error(`tenant cleanup returned ${tenant.status()}: ${await tenant.text()}`);
  }

  const user = await deleteUser(pageOrContext, identity.password);
  if (!user.ok() && user.status() !== 401) {
    throw new Error(`user cleanup returned ${user.status()}: ${await user.text()}`);
  }
}

test("Backoffice disposable owner can onboard, exercise private policy, export and cleanly delete the tenant", async ({ page }) => {
  test.setTimeout(180_000);
  const identity = uniqueIdentity();
  let userCreated = false;
  let tenantCreated = false;

  try {
    const signupResponse = await page.request.post(
      `${backofficeOrigin}/api/auth/sign-up/email`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: { name: "Mandy E2E Owner", email: identity.email, password: identity.password },
      },
    );
    expect(signupResponse.ok(), `signup returned ${signupResponse.status()}`).toBeTruthy();
    userCreated = true;

    const sessionResponse = await page.request.get(`${backofficeOrigin}/api/auth/get-session`, {
      headers: { accept: "application/json" },
    });
    expect(sessionResponse.ok()).toBeTruthy();
    expect((await sessionResponse.json())?.user?.email).toBe(identity.email);

    const organizationResponse = await page.request.post(
      `${backofficeOrigin}/api/auth/organization/create`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: {
          name: identity.restaurantName,
          slug: `mandys-${identity.restaurantSlug}`,
        },
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
          publicName: identity.restaurantName,
          locationName: "Principal",
          slug: identity.restaurantSlug,
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

    const billingResponse = await page.request.get(`${backofficeOrigin}/api/billing/v1/billing`, {
      headers: { accept: "application/json" },
    });
    expect(
      billingResponse.ok(),
      `billing returned ${billingResponse.status()}: ${await billingResponse.text()}`,
    ).toBeTruthy();
    const billing = await billingResponse.json();
    expect(billing?.data?.plans?.length).toBeGreaterThanOrEqual(5);
    for (const plan of billing.data.plans) {
      expect(plan.monthlyPriceCents).toBeNull();
      expect(plan.annualPriceCents).toBeNull();
    }

    // Media must never degrade to an unsigned public upload. It is valid for an
    // environment to be intentionally unconfigured; once configured, the response
    // may expose the publishable API key and signature but never the API secret.
    const mediaResponse = await page.request.post(`${backofficeOrigin}/api/media/v1/signature`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { kind: "logo" },
    });
    const media = await mediaResponse.json();
    if (mediaResponse.status() === 503) {
      expect(media?.error).toBe("MEDIA_NOT_CONFIGURED");
    } else {
      expect(mediaResponse.ok()).toBeTruthy();
      expect(media?.data?.signature).toBeTruthy();
      expect(media?.data?.uploadPreset).toBeTruthy();
      expect(media?.data?.folder).toContain("mandys/tenant-");
      expect(media?.data?.apiSecret).toBeUndefined();
    }

    const protectedAccountDelete = await deleteUser(page, identity.password);
    expect(protectedAccountDelete.status()).toBe(400);

    const exportResponse = await page.request.get(
      `${backofficeOrigin}/api/data-protection/v1/export`,
      { headers: { accept: "application/json" } },
    );
    expect(exportResponse.ok()).toBeTruthy();
    const exported = await exportResponse.json();
    expect(exported?.format).toBe("mandys-tenant-export-v1");
    expect(exported?.organization?.name).toBe(identity.restaurantName);
    expect(exported?.team?.members?.length).toBeGreaterThanOrEqual(1);

    const tenantDeleteResponse = await deleteTenant(page);
    expect(tenantDeleteResponse.ok()).toBeTruthy();
    expect((await tenantDeleteResponse.json())?.data?.deleted).toBe(true);
    tenantCreated = false;

    const accountDeleteResponse = await deleteUser(page, identity.password);
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
          await signIn(page, identity.email, identity.password);
        }
        if (tenantCreated) {
          const cleanupTenant = await deleteTenant(page);
          if (cleanupTenant.ok()) tenantCreated = false;
        }
        const cleanupUser = await deleteUser(page, identity.password);
        if (cleanupUser.ok()) userCreated = false;
      } catch {
        // Best-effort cleanup. Post-run database checks catch any E2E leftovers.
      }
    }
  }
});

test("active organization and tenant-scoped APIs resist cross-tenant spoofing", async ({ browser }) => {
  test.setTimeout(240_000);
  const identityA = uniqueIdentity("tenant-a");
  const identityB = uniqueIdentity("tenant-b");
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  let createdA = false;
  let createdB = false;

  try {
    const organizationA = await provisionTenant(contextA, identityA);
    createdA = true;
    const organizationB = await provisionTenant(contextB, identityB);
    createdB = true;
    expect(organizationA).not.toBe(organizationB);

    const crossActive = await contextB.request.post(
      `${backofficeOrigin}/api/auth/organization/set-active`,
      {
        headers: { accept: "application/json", "content-type": "application/json" },
        data: { organizationId: organizationA },
      },
    );
    expect(crossActive.ok()).toBeFalsy();
    expect(crossActive.status()).toBeGreaterThanOrEqual(400);
    expect(crossActive.status()).toBeLessThan(500);

    const spoofedExport = await contextB.request.get(
      `${backofficeOrigin}/api/data-protection/v1/export?organizationId=${encodeURIComponent(organizationA)}`,
      {
        headers: {
          accept: "application/json",
          "x-organization-id": organizationA,
          "x-mandys-organization-id": organizationA,
        },
      },
    );
    expect(spoofedExport.ok()).toBeTruthy();
    const exportB = await spoofedExport.json();
    expect(exportB?.organization?.id).toBe(organizationB);
    expect(exportB?.organization?.name).toBe(identityB.restaurantName);
    expect(exportB?.organization?.id).not.toBe(organizationA);

    const spoofedRetention = await contextB.request.put(
      `${backofficeOrigin}/api/retention/v1/retention?organizationId=${encodeURIComponent(organizationA)}`,
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-organization-id": organizationA,
          "x-mandys-organization-id": organizationA,
        },
        data: {
          customerDataRetentionDays: 120,
          auditLogRetentionDays: 365,
          notificationRetentionDays: 60,
          organizationId: organizationA,
        },
      },
    );
    expect(spoofedRetention.ok()).toBeTruthy();
    expect((await spoofedRetention.json())?.data).toEqual({
      customerDataRetentionDays: 120,
      auditLogRetentionDays: 365,
      notificationRetentionDays: 60,
    });

    const readA = await contextA.request.get(`${backofficeOrigin}/api/retention/v1/retention`, {
      headers: { accept: "application/json" },
    });
    expect(readA.ok()).toBeTruthy();
    expect((await readA.json())?.data).toEqual({
      customerDataRetentionDays: null,
      auditLogRetentionDays: null,
      notificationRetentionDays: null,
    });

    const readB = await contextB.request.get(`${backofficeOrigin}/api/retention/v1/retention`, {
      headers: { accept: "application/json" },
    });
    expect(readB.ok()).toBeTruthy();
    expect((await readB.json())?.data).toEqual({
      customerDataRetentionDays: 120,
      auditLogRetentionDays: 365,
      notificationRetentionDays: 60,
    });
  } finally {
    if (createdB) {
      try {
        await cleanupTenantAndUser(contextB, identityB);
      } catch {
        // Best-effort cleanup, scoped to mandys-e2e-* identities only.
      }
    }
    if (createdA) {
      try {
        await cleanupTenantAndUser(contextA, identityA);
      } catch {
        // Best-effort cleanup, scoped to mandys-e2e-* identities only.
      }
    }
    await contextB.close();
    await contextA.close();
  }
});
