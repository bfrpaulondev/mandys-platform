import { expect, test } from "@playwright/test";

const backofficeOrigin = process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

function identity() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `mandys-e2e-onboarding-${token}@example.com`,
    password: `Mandy-E2E-Onboarding-${token}!Aa9`,
    name: "Mandy Onboarding Owner",
    restaurantName: `Mandy E2E Onboarding ${token}`,
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

test("onboarding checklist reaches completion and its draft resumes safely", async ({ page }) => {
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

    const sessionResponse = await page.request.get(`${backofficeOrigin}/api/auth/get-session`, { headers: { accept: "application/json" } });
    expect(sessionResponse.ok()).toBeTruthy();
    const session = await sessionResponse.json();
    const userId = session?.user?.id;
    expect(typeof userId).toBe("string");
    const draftKey = `mandys:onboarding-draft:v1:${userId}`;

    const response = await page.goto(`${backofficeOrigin}/en/onboarding`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Let's prepare your restaurant.", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Setup checklist", exact: true })).toBeVisible();
    await expect(page.getByText("75% complete", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create restaurant", exact: true })).toBeDisabled();

    await page.getByLabel("Restaurant public name", { exact: true }).fill(user.restaurantName);
    await expect(page.getByLabel("Restaurant identifier", { exact: true })).toHaveValue(/mandy-e2e-onboarding-/);
    await expect(page.getByText("100% complete", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create restaurant", exact: true })).toBeEnabled();
    await expect(page.getByText("Progress saved on this device.", { exact: true })).toBeVisible({ timeout: 5_000 });

    const savedBeforeReload = await page.evaluate((key) => window.localStorage.getItem(key), draftKey);
    expect(savedBeforeReload).toContain(user.restaurantName);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Draft resumed on this device.", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Restaurant public name", { exact: true })).toHaveValue(user.restaurantName);
    await expect(page.getByText("100% complete", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Create restaurant", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/en" || url.pathname === "/en/", { timeout: 45_000 });

    const savedAfterCompletion = await page.evaluate((key) => window.localStorage.getItem(key), draftKey);
    expect(savedAfterCompletion).toBeNull();
  } finally {
    if (created) await cleanup(page, user.password);
  }
});
