import { expect, test, type Page } from "@playwright/test";

const TZ = "Asia/Tbilisi";
const localDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const plusDays = (n: number) => localDate(new Date(Date.now() + n * 86_400_000));
function weekdayAhead(from: number) {
  for (let n = from; ; n++) {
    const day = new Date(`${plusDays(n)}T12:00:00Z`).getUTCDay();
    if (day >= 1 && day <= 5) return plusDays(n);
  }
}

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Bookeria-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard");
}

test("checkout with a split payment shows up in the cash summary", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto(`/ka/calendar?view=day&date=${weekdayAhead(1)}`);
  await page.waitForLoadState("networkidle");
  await page.locator('[role="button"][aria-label*="–"]').first().click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "ანგარიშსწორება" }).click();
  await expect(page.getByRole("dialog")).toContainText("გადასახდელი");
  await page.getByRole("dialog").getByRole("button", { name: "გაყოფილი გადახდა" }).click();
  // first line pays 10 ₾ cash, the second (card) the rest
  const amounts = page.getByRole("dialog").getByRole("textbox", { name: "თანხა" });
  const dueText = await amounts.first().inputValue();
  await amounts.first().fill("10");
  await amounts.nth(1).fill(String(Number(dueText.replace(",", ".")) - 10));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^მიღება/ })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/ka/cash");
  await expect(page.getByRole("heading", { name: "სალარო" })).toBeVisible();
  await expect(page.getByText("ნაღდი").first()).toBeVisible();
  await expect(page.getByText("ბარათი (ტერმინალი)").first()).toBeVisible();
});

test("recurring: three weekly visits in one go", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  const date = weekdayAhead(30 + Math.floor(Math.random() * 60));
  await page.goto(`/ka/calendar?view=day&date=${date}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "ახალი ჯავშანი" }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("searchbox").fill("მარიამ");
  await panel
    .getByRole("button", { name: /მარიამ/ })
    .first()
    .click();
  await panel.getByText("წარბის კორექცია").click();
  await panel.getByRole("radio").first().click();
  await panel.getByText("გამეორება").click();
  await panel.getByLabel("რამდენჯერ").fill("3");
  await panel.getByRole("button", { name: "თარიღების შემოწმება" }).click();
  await panel.getByRole("button", { name: "დაჯავშნა", exact: true }).click();
  await expect(page.getByText("შეიქმნა 3 ჯავშანი")).toBeVisible();
});

test("dental: day view by chair", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "dental.owner@demo.test");
  await page.goto(`/ka/calendar?view=day&date=${weekdayAhead(1)}`);
  await page.getByRole("tab", { name: "სავარძლებით" }).click();
  await expect(page).toHaveURL(/by=chair/);
  await expect(page.getByText("სავარძელი 1")).toBeVisible();
  await expect(page.getByText("სავარძელი 2")).toBeVisible();
  await expect(page.locator('[role="button"][aria-label*="–"]').first()).toBeVisible();
});
