import { expect, test } from "@playwright/test";

// QA-only branch touch to trigger the focused Task 26 production certification workflow.
const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-sessions-${token}@example.com`,
    password: `Mandy-E2E-Sessions-${token}!Aa9`,
    restaurantName: `Mandy E2E Sessions ${token}`,
    restaurantSlug: `mandy-e2e-sessions-${token}`.toLowerCase(),
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

async function syncRequestCookiesToBrowser(page) {
  const state = await page.request.storageState();
  const cookies = state.cookies.filter((cookie) => cookie.domain === "mandyplataform.netlify.app");
  expect(cookies.some((cookie) => cookie.name === "__Secure-mandys.session_token")).toBeTruthy();
  await page.context().addCookies(cookies);
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

test("authenticated user can review devices and revoke other sessions", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const user = identity();
  let userCreated = false;
  let tenantCreated = false;
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();

  try {
    const signup = await page.request.post(`${backofficeOrigin}/api/auth/sign-up/email`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: "Mandy Sessions Owner", email: user.email, password: user.password },
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

    // Requests made through Playwright's APIRequestContext keep their own cookie jar in
    // hosted Chromium runs. Explicitly copy the authenticated Better Auth cookie into
    // the browser context before exercising the real client-side session boundary.
    await syncRequestCookiesToBrowser(page);

    const secondSignIn = await secondPage.request.post(`${backofficeOrigin}/api/auth/sign-in/email`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { email: user.email, password: user.password },
    });
    expect(secondSignIn.ok(), `second sign-in returned ${secondSignIn.status()}: ${await secondSignIn.text()}`).toBeTruthy();

    const secondBefore = await secondPage.request.get(`${backofficeOrigin}/api/auth/get-session`, {
      headers: { accept: "application/json" },
    });
    expect(secondBefore.ok()).toBeTruthy();
    expect((await secondBefore.json())?.user?.email).toBe(user.email);

    await gotoRendered(page, `${backofficeOrigin}/en/account`);
    await expect(page.getByRole("heading", { name: "Sessions and devices", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Current session", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "End session", exact: true })).toBeVisible();

    const revokeOthers = page.getByRole("button", { name: "End other sessions", exact: true });
    await expect(revokeOthers).toBeEnabled();
    await revokeOthers.click();
    await expect(page.getByText("Other sessions ended.", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(revokeOthers).toBeDisabled();
    await expect(page.getByRole("button", { name: "End session", exact: true })).toHaveCount(0);

    const currentAfter = await page.request.get(`${backofficeOrigin}/api/auth/get-session`, {
      headers: { accept: "application/json" },
    });
    expect(currentAfter.ok()).toBeTruthy();
    expect((await currentAfter.json())?.user?.email).toBe(user.email);

    const secondAfter = await secondPage.request.get(`${backofficeOrigin}/api/auth/get-session`, {
      headers: { accept: "application/json" },
    });
    expect(secondAfter.ok()).toBeTruthy();
    const secondAfterBody = await secondAfter.json();
    expect(secondAfterBody?.user ?? null).toBeNull();
  } finally {
    await secondContext.close();
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
        // Best-effort cleanup; identity is scoped to mandys-e2e-sessions-*.
      }
    }
  }
});
