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
