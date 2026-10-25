import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // One dev server (compiles on first use) talking to the Frankfurt dev DB:
  // server actions can take a few seconds under parallel load.
  workers: process.env.CI ? undefined : 3,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    locale: "ka-GE",
    timezoneId: "Asia/Tbilisi",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 }, browserName: "chromium" },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/ka/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
