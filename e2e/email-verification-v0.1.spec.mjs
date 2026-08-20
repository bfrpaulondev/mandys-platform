import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-email-verification-${token}@example.com`,
    password: `Mandy-E2E-Email-${token}!Aa9`,
    restaurantName: `Mandy E2E Email ${token}`,
    restaurantSlug: `mandy-e2e-email-${token}`.toLowerCase(),
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

test("unverified account can request a verification email from My account", async ({ page }) => {
  test.setTimeout(180_000);
  const user = identity();
  let userCreated = false;
  let tenantCreated = false;

  try {
    const signup = await page.request.post(`${backofficeOrigin}/api/auth/sign-up/email`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: "Mandy Email Verification Owner", email: user.email, password: user.password },
    });
    expect(signup.ok(), `signup returned ${signup.status()}: ${await signup.text()}`).toBeTruthy();
    userCreated = true;

    const sessionBefore = await page.request.get(`${backofficeOrigin}/api/auth/get-session`, {
      headers: { accept: "application/json" },
    });
    expect(sessionBefore.ok()).toBeTruthy();
    expect((await sessionBefore.json())?.user?.emailVerified).toBe(false);

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

    await gotoRendered(page, `${backofficeOrigin}/en/account`);
    await expect(page.getByText("Email not verified yet", { exact: true })).toBeVisible({ timeout: 20_000 });

    const verifyButton = page.getByRole("button", { name: "Send verification email", exact: true });
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();
    await expect(page.getByText("Verification email sent. Check your spam folder too.", { exact: true })).toBeVisible({ timeout: 20_000 });
  } finally {
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
        // Best-effort cleanup; identity is scoped to mandys-e2e-email-verification-*.
      }
    }
  }
});
