import { expect, test } from "@playwright/test";

const backofficeOrigin = process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-audit-${token}@example.com`,
    password: `Mandy-E2E-Audit-${token}!Aa9`,
    name: "Mandy Audit Owner",
    restaurantName: `Mandy E2E Audit ${token}`,
    restaurantSlug: `mandy-e2e-audit-${token}`.toLowerCase(),
    areaName: `Audit Area ${token.slice(-6)}`,
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

test("audit log is tenant scoped, filterable and visible to the owner", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const user = identity();
  let created = false;
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    const signup = await postJson(page, "/api/auth/sign-up/email", { name: user.name, email: user.email, password: user.password });
    expect(signup.ok(), `signup: ${signup.status()} ${await signup.text()}`).toBeTruthy();
    created = true;

    const organization = await postJson(page, "/api/auth/organization/create", { name: user.restaurantName, slug: `mandys-${user.restaurantSlug}` });
    expect(organization.ok(), `organization: ${organization.status()} ${await organization.text()}`).toBeTruthy();
    const organizationBody = await organization.json();
    const organizationId = organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id;
    expect(typeof organizationId).toBe("string");

    const active = await postJson(page, "/api/auth/organization/set-active", { organizationId });
    expect(active.ok()).toBeTruthy();
    const onboarding = await postJson(page, "/api/runtime/v1/onboarding/restaurant", {
      publicName: user.restaurantName,
      locationName: "Principal",
      slug: user.restaurantSlug,
      countryCode: "PT",
      timezone: "Europe/Lisbon",
      currency: "EUR",
      defaultLocale: "en",
      enabledLocales: ["en"],
    });
    expect(onboarding.ok(), `onboarding: ${onboarding.status()} ${await onboarding.text()}`).toBeTruthy();

    const operations = await page.request.get(`${backofficeOrigin}/api/operations/v1/settings/operations`, { headers: { accept: "application/json" } });
    expect(operations.ok()).toBeTruthy();
    const locationId = (await operations.json())?.data?.location?.id;
    expect(typeof locationId).toBe("string");

    const area = await postJson(page, "/api/operations/v1/settings/dining-areas", { locationId, name: user.areaName, sortOrder: 0 });
    expect(area.status(), `area: ${area.status()} ${await area.text()}`).toBe(201);
    const areaId = (await area.json())?.data?.id;
    expect(typeof areaId).toBe("string");

    const anonymous = await anonymousPage.request.get(`${backofficeOrigin}/api/activity/v1/activity?limit=10`, { headers: { accept: "application/json" } });
    expect(anonymous.status()).toBe(401);

    const filtered = await page.request.get(`${backofficeOrigin}/api/activity/v1/activity?limit=100&source=team&action=dining_area.created&entityType=dining_area`, { headers: { accept: "application/json" } });
    expect(filtered.ok(), `activity: ${filtered.status()} ${await filtered.text()}`).toBeTruthy();
    const body = await filtered.json();
    expect(Array.isArray(body?.data?.data)).toBeTruthy();
    const createdEntry = body.data.data.find((item) => item.action === "dining_area.created" && item.entityId === areaId);
    expect(createdEntry).toBeTruthy();
    expect(createdEntry.source).toBe("team");
    expect(createdEntry.actorEmail).toBe(user.email);
    expect(body.data.page).toEqual(expect.objectContaining({ hasMore: expect.any(Boolean) }));
    expect(body.data.summary).toEqual(expect.objectContaining({ last_24h: expect.any(Number), today: expect.any(Number) }));
    expect(body.data.facets.some((item) => item.action === "dining_area.created" && item.entityType === "dining_area")).toBe(true);

    const response = await page.goto(`${backofficeOrigin}/en/activity`, { waitUntil: "commit", timeout: 20_000 }).catch(() => null);
    if (response) expect(response.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Activity & audit", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Dining area created", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(new RegExp(user.name, "i")).first()).toBeVisible();
    await expect(page.getByLabel("Source")).toBeVisible();
    await expect(page.getByLabel("Action")).toBeVisible();
    await expect(page.getByLabel("Area")).toBeVisible();
  } finally {
    await anonymousContext.close();
    if (created) await cleanup(page, user.password);
  }
});
