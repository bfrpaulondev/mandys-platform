import { expect, test } from "@playwright/test";

const backofficeOrigin = process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
function identity() { const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; return { email: `mandys-e2e-areas-${token}@example.com`, password: `Mandy-E2E-Areas-${token}!Aa9`, restaurantName: `Mandy E2E Areas ${token}`, restaurantSlug: `mandy-e2e-areas-${token}`.toLowerCase(), areaName: `Sala ${token.slice(-6)}`, tableName: `Mesa ${token.slice(-6)}` }; }
async function deleteTenant(page) { return page.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { confirmation: "DELETE" } }); }
async function deleteUser(page, password) { return page.request.post(`${backofficeOrigin}/api/auth/delete-user`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { password } }); }

test("owner can create, edit and deactivate areas and tables without deleting history", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const user = identity(); let userCreated = false; let tenantCreated = false;
  const anonymousContext = await browser.newContext(); const anonymousPage = await anonymousContext.newPage();
  try {
    const signup = await page.request.post(`${backofficeOrigin}/api/auth/sign-up/email`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { name: "Mandy Areas Owner", email: user.email, password: user.password } }); expect(signup.ok()).toBeTruthy(); userCreated = true;
    const organization = await page.request.post(`${backofficeOrigin}/api/auth/organization/create`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { name: user.restaurantName, slug: `mandys-${user.restaurantSlug}` } }); expect(organization.ok()).toBeTruthy(); const organizationBody = await organization.json(); const organizationId = organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id; expect(typeof organizationId).toBe("string"); tenantCreated = true;
    const active = await page.request.post(`${backofficeOrigin}/api/auth/organization/set-active`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { organizationId } }); expect(active.ok()).toBeTruthy();
    const onboarding = await page.request.post(`${backofficeOrigin}/api/runtime/v1/onboarding/restaurant`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { publicName: user.restaurantName, locationName: "Principal", slug: user.restaurantSlug, countryCode: "PT", timezone: "Europe/Lisbon", currency: "EUR", defaultLocale: "en", enabledLocales: ["en"] } }); expect(onboarding.ok()).toBeTruthy();

    const anonymous = await anonymousPage.request.get(`${backofficeOrigin}/api/operations/v1/settings/operations`, { headers: { accept: "application/json" } }); expect(anonymous.status()).toBe(401);
    const operations = await page.request.get(`${backofficeOrigin}/api/operations/v1/settings/operations`, { headers: { accept: "application/json" } }); expect(operations.ok()).toBeTruthy(); const operationsBody = await operations.json(); const locationId = operationsBody?.data?.location?.id; expect(typeof locationId).toBe("string");

    const area = await page.request.post(`${backofficeOrigin}/api/operations/v1/settings/dining-areas`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { locationId, name: user.areaName, sortOrder: 0 } }); expect(area.status()).toBe(201); const areaBody = await area.json(); const areaId = areaBody?.data?.id; expect(typeof areaId).toBe("string");
    const table = await page.request.post(`${backofficeOrigin}/api/operations/v1/settings/tables`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { locationId, diningAreaId: areaId, name: user.tableName, minSeats: 1, maxSeats: 4 } }); expect(table.status()).toBe(201); const tableBody = await table.json(); const tableId = tableBody?.data?.id; expect(typeof tableId).toBe("string");

    const tableUpdate = await page.request.patch(`${backofficeOrigin}/api/operations/v1/settings/tables/${tableId}`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { locationId, diningAreaId: areaId, name: `${user.tableName} A`, minSeats: 2, maxSeats: 6, isActive: true } }); expect(tableUpdate.ok(), `table update returned ${tableUpdate.status()}: ${await tableUpdate.text()}`).toBeTruthy();
    const areaUpdate = await page.request.patch(`${backofficeOrigin}/api/operations/v1/settings/dining-areas/${areaId}`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { locationId, name: `${user.areaName} A`, sortOrder: 1, isActive: false } }); expect(areaUpdate.ok(), `area update returned ${areaUpdate.status()}: ${await areaUpdate.text()}`).toBeTruthy();

    const after = await page.request.get(`${backofficeOrigin}/api/operations/v1/settings/operations`, { headers: { accept: "application/json" } }); expect(after.ok()).toBeTruthy(); const afterBody = await after.json(); expect(afterBody.data.diningAreas.find((row) => row.id === areaId)?.isActive).toBe(false); expect(afterBody.data.tables.find((row) => row.id === tableId)?.isActive).toBe(false);

    const response = await page.goto(`${backofficeOrigin}/en/settings`, { waitUntil: "commit", timeout: 20_000 }).catch(() => null); if (response) expect(response.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Dining areas", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByDisplayValue(`${user.areaName} A`)).toBeVisible();
    await expect(page.getByDisplayValue(`${user.tableName} A`)).toBeVisible();
  } finally {
    await anonymousContext.close();
    if (tenantCreated) { try { const tenant = await deleteTenant(page); if (tenant.ok()) tenantCreated = false; } catch {} }
    if (userCreated) { try { const account = await deleteUser(page, user.password); if (account.ok()) userCreated = false; } catch {} }
  }
});
