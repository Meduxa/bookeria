// Before-the-pilot items. Needs the dev project seeded (npm run db:seed) and .env.local.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { assertDevProject } from "../scripts/dev-project.mts";

config({ path: ".env.local", quiet: true });

const PASSWORD = "Demo-Bookeria-2026";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertDevProject(url, "The end-to-end tests");
  return createClient(url!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

// A throwaway staff member of the demo salon: signing out "everywhere" must not
// end the sessions of the shared demo accounts other tests are using.
async function tempStaff(tag: string) {
  const db = admin();
  const email = `signout.${tag}.${Date.now()}@demo.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user");
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", "demo-salon").single();
  const m = await db
    .from("memberships")
    .insert({ tenant_id: tenant!.id, user_id: data.user.id, role: "staff" });
  if (m.error) throw m.error;
  return { email, remove: () => db.auth.admin.deleteUser(data.user.id) };
}

test("sign out of all devices ends the other device's session too", async ({ browser }, info) => {
  const user = await tempStaff(info.project.name);
  try {
    const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [phone, laptop] = await Promise.all([a.newPage(), b.newPage()]);
    for (const page of [phone, laptop]) {
      await page.goto("/ka/login");
      await page.getByLabel("ელფოსტა").fill(user.email);
      await page.getByLabel("პაროლი").fill(PASSWORD);
      await page.getByRole("button", { name: "შესვლა" }).click();
      await page.waitForURL(/\/ka\/(dashboard|my-day)/);
    }

    await phone
      .getByRole("button", { name: /სალონი ნინო/ })
      .first()
      .click();
    await phone.getByRole("menuitem", { name: "ყველა მოწყობილობიდან გასვლა" }).click();
    await phone.getByRole("button", { name: "ყველგან გასვლა" }).click();
    await phone.waitForURL("**/ka/login");

    // the laptop's next page load finds the session gone
    await laptop.goto("/ka/clients");
    await expect(laptop).toHaveURL(/\/ka\/login/);
    await Promise.all([a.close(), b.close()]);
  } finally {
    await user.remove();
  }
});
