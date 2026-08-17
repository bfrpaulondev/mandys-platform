import { expect, test } from '@playwright/test';

const backoffice = 'https://mandyplataform.netlify.app';
const storefront = 'https://mandy-store-front.netlify.app';

test.describe('Mandy\'s V0.1 live Netlify smoke', () => {
  test('backoffice login is reachable and interactive', async ({ page }) => {
    const response = await page.goto(`${backoffice}/en/login`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Run your restaurant from one place.' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: "Sign in to Mandy's" })).toBeVisible();
  });

  test('new owner can create an account and onboard a restaurant', async ({ page }) => {
    const id = Date.now();
    const email = `mandys.e2e+${id}@example.com`;
    const restaurantName = `Mandy's E2E ${id}`;

    await page.goto(`${backoffice}/en/login`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: "New to Mandy's? Create an account" }).click();
    await page.getByLabel('Name').fill('Mandy E2E Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Mandys-E2E-2026!');
    await page.getByRole('button', { name: 'Create account and continue' }).click();

    await page.waitForURL(/\/en\/onboarding/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: "Let's prepare your restaurant." })).toBeVisible();
    await page.getByLabel('Restaurant public name').fill(restaurantName);
    await page.getByLabel('City').fill('Setúbal');
    await page.getByRole('button', { name: 'Create restaurant' }).click();

    await page.waitForURL(/\/en\/?$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: restaurantName })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Your restaurant operation, in one place.')).toBeVisible();
  });

  test('storefront loads the live demo menu', async ({ page }) => {
    const response = await page.goto(`${storefront}/pt-PT#menu`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toContainText(/Maré|Menu|Reserv/i);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/storefront not found|reservations unavailable|erro interno/i);
  });

  test('responsive pages render without horizontal overflow', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`${storefront}/pt-PT#menu`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});
