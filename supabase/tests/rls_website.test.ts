import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/lib/supabase/database.types";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// The business website settings (cover, logo, about, links, theme) in tenant_settings.
let A: TestTenant;
let B: TestTenant;

beforeAll(async () => {
  A = await createTenant("webA", "salon");
  B = await createTenant("webB", "salon");
});
afterAll(cleanup);

const site = async (t: TestTenant) =>
  (
    await admin()
      .from("tenant_settings")
      .select("site_theme, site_instagram, site_cover_path, site_about")
      .eq("tenant_id", t.id)
      .single()
  ).data!;

describe("business website settings", () => {
  it("owner and admin edit their own business's website", async () => {
    const r = await A.owner.db
      .from("tenant_settings")
      .update({
        site_theme: "rose",
        site_instagram: "salon.a",
        site_cover_path: `${A.id}/cover.jpg`,
        site_about: { ka: "ჩვენ შესახებ", en: "About us" },
      })
      .eq("tenant_id", A.id);
    expect(r.error).toBeNull();
    expect(
      (await A.adminUser.db.from("tenant_settings").update({ site_theme: "ocean" }).eq("tenant_id", A.id))
        .error,
    ).toBeNull();
    expect(await site(A)).toMatchObject({ site_theme: "ocean", site_instagram: "salon.a" });
  });

  it("staff, other businesses and visitors cannot change it", async () => {
    await A.staff.db.from("tenant_settings").update({ site_theme: "amber" }).eq("tenant_id", A.id);
    await B.owner.db.from("tenant_settings").update({ site_theme: "amber" }).eq("tenant_id", A.id);
    await anon().from("tenant_settings").update({ site_theme: "amber" }).eq("tenant_id", A.id);
    expect((await site(A)).site_theme).toBe("ocean");
    expect(
      (await anon().from("tenant_settings").select("site_about").eq("tenant_id", A.id)).data ?? [],
    ).toEqual([]);
    expect(
      (await B.owner.db.from("tenant_settings").select("site_about").eq("tenant_id", A.id)).data,
    ).toEqual([]);
  });

  it("photos must be in the business's own folder; values are checked", async () => {
    const set = (v: Database["public"]["Tables"]["tenant_settings"]["Update"]) =>
      A.owner.db.from("tenant_settings").update(v).eq("tenant_id", A.id);
    expect((await set({ site_cover_path: `${B.id}/cover.jpg` })).error).not.toBeNull();
    expect((await set({ site_logo_path: `${A.id}/../x.jpg` })).error).not.toBeNull();
    expect((await set({ site_theme: "neon" })).error).not.toBeNull();
    expect((await set({ site_instagram: "https://evil.example/x" })).error).not.toBeNull();
    expect((await set({ site_about: { de: "x" } })).error).not.toBeNull();
    expect((await set({ site_about: { ka: "x".repeat(1001) } })).error).not.toBeNull();
    expect((await set({ site_logo_path: `${A.id}/logo.png` })).error).toBeNull();
  });
});
