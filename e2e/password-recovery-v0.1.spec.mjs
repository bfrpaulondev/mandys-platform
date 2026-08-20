import { expect, test } from "@playwright/test";

const backofficeOrigin =
  process.env.MANDYS_BACKOFFICE_ORIGIN ?? "https://mandyplataform.netlify.app";

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

test("password recovery request stays enumeration-safe and invalid reset links fail closed", async ({ page }) => {
  test.setTimeout(90_000);
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const unknownEmail = `mandys-e2e-recovery-${token}@example.com`;

  await gotoRendered(page, `${backofficeOrigin}/en/login`);
  await page.getByRole("button", { name: "Forgot your password?", exact: true }).click();
  await expect(page.getByText("Recover password", { exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(unknownEmail);
  await page.getByRole("button", { name: "Send recovery link", exact: true }).click();

  await expect(
    page.getByText(
      "If an account exists for this email, you'll receive a recovery link. Check your spam folder too.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15_000 });

  await gotoRendered(page, `${backofficeOrigin}/en/reset-password`);
  await expect(
    page.getByText(
      "This recovery link is invalid or expired. Request a new link from the sign-in screen.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("New password", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Confirm new password", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Set new password", exact: true })).toBeDisabled();
});
