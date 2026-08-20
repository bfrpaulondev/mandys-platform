import { expect, test } from "@playwright/test";

const backofficeOrigin = process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-onboarding-validation-${token}@example.com`,
    password: `Mandy-E2E-Validation-${token}!Aa9`,
    name: "Mandy Validation Owner",
    restaurantName: `Mandy E2E Validation ${token}`,
    restaurantSlug: `mandy-e2e-validation-${token}`,
  };
}

async function postJson(page, path, data) {
  return page.request.post(`${backofficeOrigin}${path}`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data,
  });
}

async function cleanup(page, password) {
  await page.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    data: { confirmation: "DELETE" },
  }).catch(() => null);
  await postJson(page, "/api/auth/delete-user", { password }).catch(() => null);
}

test("onboarding rejects invalid regional and locale combinations end to end", async ({ page }) => {
  test.setTimeout(180_000);
  const user = identity();
  let created = false;

  try {
    const signup = await postJson(page, "/api/auth/sign-up/email", {
      name: user.name,
      email: user.email,
      password: user.password,
    });
    expect(signup.ok(), `signup: ${signup.status()} ${await signup.text()}`).toBeTruthy();
    created = true;

    const organization = await postJson(page, "/api/auth/organization/create", {
      name: user.restaurantName,
      slug: `mandys-${user.restaurantSlug}`,
    });
    expect(organization.ok(), `organization: ${organization.status()} ${await organization.text()}`).toBeTruthy();
    const organizationBody = await organization.json();
    const organizationId = organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
    expect(typeof organizationId).toBe("string");

    const active = await postJson(page, "/api/auth/organization/set-active", { organizationId });
    expect(active.ok(), `set active: ${active.status()} ${await active.text()}`).toBeTruthy();

    const valid = {
      publicName: user.restaurantName,
      locationName: "Principal",
      slug: user.restaurantSlug,
      countryCode: "PT",
      timezone: "Europe/Lisbon",
      currency: "EUR",
      defaultLocale: "en",
      enabledLocales: ["en", "pt-PT"],
    };

    const invalidPayloads = [
      { ...valid, countryCode: "ZZ" },
      { ...valid, currency: "ZZZ" },
      { ...valid, timezone: "Mars/Olympus" },
      { ...valid, defaultLocale: "pt-PT", enabledLocales: ["en", "es"] },
      { ...valid, defaultLocale: "en", enabledLocales: ["en", "en"] },
    ];

    for (const payload of invalidPayloads) {
      const response = await postJson(page, "/api/runtime/v1/onboarding/restaurant", payload);
      expect(response.status(), `invalid onboarding unexpectedly returned ${response.status()}: ${await response.text()}`).toBe(400);
    }

    const response = await page.goto(`${backofficeOrigin}/en/onboarding`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Setup checklist", exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByLabel("Restaurant public name", { exact: true }).fill(user.restaurantName);
    await expect(page.getByText("100% complete", { exact: true })).toBeVisible();
    const submit = page.getByRole("button", { name: "Create restaurant", exact: true });
    await expect(submit).toBeEnabled();

    await page.getByLabel("Country (ISO 2)", { exact: true }).fill("ZZ");
    await expect(page.getByText("75% complete", { exact: true })).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.getByLabel("Country (ISO 2)", { exact: true }).fill("PT");
    await expect(page.getByText("100% complete", { exact: true })).toBeVisible();

    await page.getByLabel("Currency (ISO 3)", { exact: true }).fill("ZZZ");
    await expect(page.getByText("75% complete", { exact: true })).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.getByLabel("Currency (ISO 3)", { exact: true }).fill("EUR");
    await expect(page.getByText("100% complete", { exact: true })).toBeVisible();

    await page.getByLabel("Timezone", { exact: true }).fill("Mars/Olympus");
    await expect(page.getByText("75% complete", { exact: true })).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.getByLabel("Timezone", { exact: true }).fill("Europe/Lisbon");
    await expect(page.getByText("100% complete", { exact: true })).toBeVisible();

    await submit.click();
    await page.waitForURL((url) => url.pathname === "/en" || url.pathname === "/en/", { timeout: 45_000 });
  } finally {
    if (created) await cleanup(page, user.password);
  }
});
