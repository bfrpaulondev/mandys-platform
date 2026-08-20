import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-notifications-${token}@example.com`,
    password: `Mandy-E2E-Notifications-${token}!Aa9`,
    restaurantName: `Mandy E2E Notifications ${token}`,
    restaurantSlug: `mandy-e2e-notifications-${token}`.toLowerCase(),
  };
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

async function deleteTenant(page) {
  return page.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { confirmation: "DELETE" },
  });
}

async function deleteUser(page, password) {
  return page.request.post(`${backofficeOrigin}/api/auth/delete-user`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { password },
  });
}

test("notification center is tenant scoped, authenticated and usable", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const user = identity();
  let userCreated = false;
  let tenantCreated = false;
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    const signup = await page.request.post(`${backofficeOrigin}/api/auth/sign-up/email`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: "Mandy Notifications Owner", email: user.email, password: user.password },
    });
    expect(signup.ok(), `signup returned ${signup.status()}: ${await signup.text()}`).toBeTruthy();
    userCreated = true;

    const organization = await page.request.post(`${backofficeOrigin}/api/auth/organization/create`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: user.restaurantName, slug: `mandys-${user.restaurantSlug}` },
    });
    expect(organization.ok(), `organization returned ${organization.status()}: ${await organization.text()}`).toBeTruthy();
    const organizationBody = await organization.json();
    const organizationId = organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
    expect(typeof organizationId).toBe("string");
    tenantCreated = true;

    const active = await page.request.post(`${backofficeOrigin}/api/auth/organization/set-active`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { organizationId },
    });
    expect(active.ok(), `set-active returned ${active.status()}: ${await active.text()}`).toBeTruthy();

    const onboarding = await page.request.post(`${backofficeOrigin}/api/runtime/v1/onboarding/restaurant`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: {
        publicName: user.restaurantName,
        locationName: "Principal",
        slug: user.restaurantSlug,
        countryCode: "PT",
        timezone: "Europe/Lisbon",
        currency: "EUR",
        defaultLocale: "en",
        enabledLocales: ["en"],
      },
    });
    expect(onboarding.ok(), `onboarding returned ${onboarding.status()}: ${await onboarding.text()}`).toBeTruthy();

    const apiResponse = await page.request.get(`${backofficeOrigin}/api/notifications/v1/notifications?limit=25&offset=0`, {
      headers: { accept: "application/json" },
    });
    expect(apiResponse.ok(), `notifications returned ${apiResponse.status()}: ${await apiResponse.text()}`).toBeTruthy();
    const apiBody = await apiResponse.json();
    expect(Array.isArray(apiBody?.data?.notifications)).toBeTruthy();
    expect(Number.isInteger(apiBody?.data?.total)).toBeTruthy();
    expect(Number.isInteger(apiBody?.data?.unread)).toBeTruthy();
    expect(apiBody?.data?.pagination?.limit).toBe(25);
    expect(apiBody?.data?.pagination?.offset).toBe(0);
    expect(typeof apiBody?.data?.pagination?.hasMore).toBe("boolean");

    const unreadResponse = await page.request.get(`${backofficeOrigin}/api/notifications/v1/notifications?limit=25&offset=0&unread=true`, {
      headers: { accept: "application/json" },
    });
    expect(unreadResponse.ok()).toBeTruthy();

    const anonymous = await anonymousPage.request.get(`${backofficeOrigin}/api/notifications/v1/notifications`, {
      headers: { accept: "application/json" },
    });
    expect(anonymous.status()).toBe(401);

    await gotoRendered(page, `${backofficeOrigin}/en/notifications`);
    await expect(page.getByRole("heading", { name: "Notification center", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unread", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark all as read", exact: true })).toBeVisible();
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
    await expect(page.getByText("Unread", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Unread", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unread", exact: true })).toHaveAttribute("aria-pressed", "true");
  } finally {
    await anonymousContext.close();
    if (tenantCreated) {
      try {
        const tenant = await deleteTenant(page);
        if (tenant.ok()) tenantCreated = false;
      } catch {
        // Best-effort cleanup; shared E2E hygiene checks detect leftovers.
      }
    }
    if (userCreated) {
      try {
        const account = await deleteUser(page, user.password);
        if (account.ok()) userCreated = false;
      } catch {
        // Best-effort cleanup; identity is scoped to mandys-e2e-notifications-*.
      }
    }
  }
});
