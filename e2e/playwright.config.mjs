import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Live E2E crosses Netlify and Supabase. Keep every functional assertion,
  // but give isolated worker retries enough room to recover from transient
  // transport resets or a one-off hydration navigation without contaminating
  // later tests in the suite.
  retries: process.env.CI ? 2 : 0,
  retryStrategy: "isolated",
  workers: 1,
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
