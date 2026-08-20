import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-password-${token}@example.com`,
    password: `Mandy-E2E-Old-${token}!Aa9`,
    nextPassword: `Mandy-E2E-New-${token}!Bb8`,
    restaurantName: `Mandy E2E Password ${token}`,
    restaurantSlug: `mandy-e2e-password-${token}`.toLowerCase(),
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

async function signInRequest(page, email, password) {
  return page.request.post(`${backofficeOrigin}/api/auth/sign-in/email`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { email, password },
  });
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

test("authenticated user can change password without losing active restaurant context", async ({ page }) => {
  test.setTimeout(180_000);
  const user = identity();
  let userCreated = false;
  let tenantCreated = false;
  let currentPassword = user.password;

  try {
    const signup = await page.request.post(`${backofficeOrigin}/api/auth/sign-up/email`, {
      headers: { accept: "application/json", "content-type": "application/json" },
      data: { name: "Mandy Password Owner", email: user.email, password: user.password },
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

    await gotoRendered(page, `${backofficeOrigin}/en/account`);
    await expect(page.getByRole("heading", { name: "Change password", exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Current password", { exact: true }).fill(user.password);
    await page.getByLabel("New password", { exact: true }).fill(user.nextPassword);
    await page.getByLabel("Confirm new password", { exact: true }).fill(user.nextPassword);
    await page.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page.getByText("Password changed successfully.", { exact: true })).toBeVisible({ timeout: 15_000 });
    currentPassword = user.nextPassword;

    const dashboard = await page.request.get(`${backofficeOrigin}/api/dashboard`, {
      headers: { accept: "application/json" },
    });
    expect(dashboard.ok(), `active restaurant context was lost after password change: ${dashboard.status()} ${await dashboard.text()}`).toBeTruthy();

    const tenantDelete = await deleteTenant(page);
    expect(tenantDelete.ok(), `tenant cleanup returned ${tenantDelete.status()}: ${await tenantDelete.text()}`).toBeTruthy();
    tenantCreated = false;

    const signOut = await page.request.post(`${backofficeOrigin}/api/auth/sign-out`, {
      headers: { accept: "application/json", "content-type": "application/json" },
    });
    expect(signOut.ok()).toBeTruthy();

    const oldPassword = await signInRequest(page, user.email, user.password);
    expect(oldPassword.ok(), "old password unexpectedly authenticated after password change").toBeFalsy();

    const newPassword = await signInRequest(page, user.email, user.nextPassword);
    expect(newPassword.ok(), `new password sign-in returned ${newPassword.status()}: ${await newPassword.text()}`).toBeTruthy();

    const accountDelete = await deleteUser(page, user.nextPassword);
    expect(accountDelete.ok(), `user cleanup returned ${accountDelete.status()}: ${await accountDelete.text()}`).toBeTruthy();
    userCreated = false;
  } finally {
    if (tenantCreated) {
      try {
        const tenant = await deleteTenant(page);
        if (tenant.ok()) tenantCreated = false;
      } catch {
        // Best-effort cleanup; scoped E2E identities are checked separately.
      }
    }
    if (userCreated) {
      try {
        const session = await page.request.get(`${backofficeOrigin}/api/auth/get-session`, {
          headers: { accept: "application/json" },
        });
        if (!session.ok() || (await session.text()) === "null") {
          await signInRequest(page, user.email, currentPassword);
        }
        const account = await deleteUser(page, currentPassword);
        if (account.ok()) userCreated = false;
      } catch {
        // Best-effort cleanup; identity is scoped to mandys-e2e-password-*.
      }
    }
  }
});
