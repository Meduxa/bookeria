// Needs the dev project seeded (npm run db:seed).
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Bookeria-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" }); // the page itself may still be loading
}

test("visitors land on the Georgian sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ka\/login$/);
  await expect(page.getByRole("heading", { name: "შესვლა" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
});

test("protected pages send visitors to sign-in", async ({ page }) => {
  await page.goto("/en/settings/team");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fsettings%2Fteam$/);
});

test("owner signs in, sees the dashboard and the team", async ({ page }) => {
  await signIn(page, "salon.owner@demo.test");
  await expect(page.getByRole("heading", { name: /გამარჯობა, ნინო/ })).toBeVisible();
  await page.goto("/ka/settings/team");
  await expect(page.getByText("ანა გელაშვილი")).toBeVisible();
  await expect(page.getByRole("button", { name: "მოწვევის გაგზავნა" })).toBeVisible();
});

test("staff cannot invite", async ({ page }) => {
  await signIn(page, "dental.doctor@demo.test");
  await page.goto("/ka/settings/team");
  await expect(page.getByText("ხალხის მოწვევა მხოლოდ მფლობელს")).toBeVisible();
  await expect(page.getByRole("button", { name: "მოწვევის გაგზავნა" })).toHaveCount(0);
});

test("switching language keeps the page", async ({ page }) => {
  await page.goto("/ka/login");
  await page.getByRole("button", { name: /ენა|ქართული/ }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("no horizontal scroll at phone width", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await signIn(page, "salon.owner@demo.test");
  for (const path of ["/ka/dashboard", "/ka/settings/team", "/ka/onboarding"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("an action on a page left open after signing out goes to sign-in, not an error", async ({ context }) => {
  const page = await context.newPage();
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/settings/team");

  // Same as signing out in another tab: the session cookie disappears while
  // this page stays open.
  await context.clearCookies();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("ელფოსტა").fill("stale@example.test");
  await page.getByRole("button", { name: "მოწვევის გაგზავნა" }).click();
  await page.waitForURL(/\/ka\/login/);
  expect(errors).toEqual([]);
});
