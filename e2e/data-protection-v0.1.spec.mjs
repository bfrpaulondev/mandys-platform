import { expect, test } from "@playwright/test";

const backofficeOrigin = process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";
function identity() { const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; return { email: `mandys-e2e-data-${token}@example.com`, password: `Mandy-E2E-Data-${token}!Aa9`, restaurantName: `Mandy E2E Data ${token}`, restaurantSlug: `mandy-e2e-data-${token}`.toLowerCase() }; }
async function deleteTenant(page) { return page.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { confirmation: "DELETE" } }); }
async function deleteUser(page, password) { return page.request.post(`${backofficeOrigin}/api/auth/delete-user`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { password } }); }

test("owner export and destructive confirmation stay tenant scoped and fail closed", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const user = identity(); let userCreated = false; let tenantCreated = false;
  const anonymousContext = await browser.newContext(); const anonymousPage = await anonymousContext.newPage();
  try {
    const signup = await page.request.post(`${backofficeOrigin}/api/auth/sign-up/email`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { name: "Mandy Data Owner", email: user.email, password: user.password } });
    expect(signup.ok(), `signup returned ${signup.status()}: ${await signup.text()}`).toBeTruthy(); userCreated = true;
    const organization = await page.request.post(`${backofficeOrigin}/api/auth/organization/create`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { name: user.restaurantName, slug: `mandys-${user.restaurantSlug}` } });
    expect(organization.ok()).toBeTruthy(); const organizationBody = await organization.json(); const organizationId = organizationBody?.id ?? organizationBody?.data?.id ?? organizationBody?.organization?.id; expect(typeof organizationId).toBe("string"); tenantCreated = true;
    const active = await page.request.post(`${backofficeOrigin}/api/auth/organization/set-active`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { organizationId } }); expect(active.ok()).toBeTruthy();
    const onboarding = await page.request.post(`${backofficeOrigin}/api/runtime/v1/onboarding/restaurant`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { publicName: user.restaurantName, locationName: "Principal", slug: user.restaurantSlug, countryCode: "PT", timezone: "Europe/Lisbon", currency: "EUR", defaultLocale: "en", enabledLocales: ["en"] } }); expect(onboarding.ok()).toBeTruthy();

    const anonymousExport = await anonymousPage.request.get(`${backofficeOrigin}/api/data-protection/v1/export`, { headers: { accept: "application/json" } }); expect(anonymousExport.status()).toBe(401);
    const exportResponse = await page.request.get(`${backofficeOrigin}/api/data-protection/v1/export`, { headers: { accept: "application/json" } }); expect(exportResponse.ok(), `export returned ${exportResponse.status()}: ${await exportResponse.text()}`).toBeTruthy(); expect(exportResponse.headers()["content-disposition"] ?? "").toContain("attachment;");
    const exportBody = await exportResponse.json(); expect(exportBody?.format).toBe("mandys-tenant-export-v1"); expect(exportBody?.organization?.id).toBe(organizationId);

    const refusedDelete = await page.request.delete(`${backofficeOrigin}/api/data-protection/v1/tenant`, { headers: { accept: "application/json", "content-type": "application/json" }, data: { confirmation: "delete" } }); expect(refusedDelete.status()).toBe(400);
    const stillThere = await page.request.get(`${backofficeOrigin}/api/operations/v1/settings/operations`, { headers: { accept: "application/json" } }); expect(stillThere.ok()).toBeTruthy();

    const response = await page.goto(`${backofficeOrigin}/en/data`, { waitUntil: "commit", timeout: 20_000 }).catch(() => null); if (response) expect(response.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Data & privacy", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Download export", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete permanently", exact: true })).toBeDisabled();
  } finally {
    await anonymousContext.close();
    if (tenantCreated) { try { const tenant = await deleteTenant(page); if (tenant.ok()) tenantCreated = false; } catch {} }
    if (userCreated) { try { const account = await deleteUser(page, user.password); if (account.ok()) userCreated = false; } catch {} }
  }
});
