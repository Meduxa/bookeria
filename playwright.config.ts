import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
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
