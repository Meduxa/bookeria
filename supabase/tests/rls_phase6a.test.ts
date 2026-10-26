import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, createUser, type TestTenant, type TestUser } from "./helpers";

// Phase 6a: platform admin, plans and limits, deletion, export, photos.
let A: TestTenant;
let B: TestTenant;
let platform: TestUser;
const server = () => admin();

beforeAll(async () => {
  A = await createTenant("p6a", "salon");
  B = await createTenant("p6b", "salon");
  platform = await createUser("platform");
  await server().from("platform_admins").insert({ user_id: platform.id });
});
afterAll(async () => {
  await server().from("platform_admins").delete().eq("user_id", platform.id);
  await cleanup();
});

describe("platform admin", () => {
  it("only platform admins see all businesses", async () => {
    expect((await platform.db.rpc("is_platform_admin")).data).toBe(true);
    expect((await A.owner.db.rpc("is_platform_admin")).data).toBe(false);
    const list = (await platform.db.rpc("admin_tenants")).data as { id: string; sms_balance: number }[];
    expect(list.map((t) => t.id)).toEqual(expect.arrayContaining([A.id, B.id]));
    expect((await A.owner.db.rpc("admin_tenants")).error?.code).toBe("42501");
    expect((await anon().rpc("admin_tenants")).error).not.toBeNull();
    expect((await anon().from("platform_admins").select("*")).data ?? []).toEqual([]);
    expect((await A.owner.db.from("platform_admins").insert({ user_id: A.owner.id })).error).not.toBeNull();
  });

  it("only platform admins change plans, status and SMS credits", async () => {
    const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const args = { p_tenant: A.id, p_plan: "pro", p_status: "active", p_trial_ends_at: until };
    expect((await A.owner.db.rpc("admin_update_tenant", args)).error?.code).toBe("42501");
    expect(
      (await A.owner.db.from("tenants").update({ plan: "pro", status: "active" }).eq("id", A.id)).error,
    ).not.toBeNull();
    expect((await platform.db.rpc("admin_update_tenant", args)).error).toBeNull();
    const { data } = await server().from("tenants").select("plan, status").eq("id", A.id).single();
    expect(data).toEqual({ plan: "pro", status: "active" });

    expect(
      (await A.owner.db.rpc("admin_topup_sms", { p_tenant: A.id, p_segments: 500, p_note: "x" })).error?.code,
    ).toBe("42501");
    expect(
      (await platform.db.rpc("admin_topup_sms", { p_tenant: A.id, p_segments: 500, p_note: "invoice 1" }))
        .error,
    ).toBeNull();
    expect((await A.owner.db.rpc("sms_balance", { p_tenant: A.id })).data).toBe(550);
    expect((await A.owner.db.rpc("admin_sms_log", {})).error?.code).toBe("42501");
    expect((await platform.db.rpc("admin_sms_log", {})).error).toBeNull();
  });

  it("plans: everyone signed in reads them, only platform admins edit", async () => {
    expect((await A.owner.db.from("plans").select("code")).data!.length).toBeGreaterThanOrEqual(4);
    await A.owner.db.from("plans").update({ price_minor: 1 }).eq("code", "start");
    expect(
      (await server().from("plans").select("price_minor").eq("code", "start").single()).data!.price_minor,
    ).toBe(0);
    expect(
      (await platform.db.from("plans").update({ price_minor: 4900 }).eq("code", "start")).error,
    ).toBeNull();
    expect(
      (await server().from("plans").select("price_minor").eq("code", "start").single()).data!.price_minor,
    ).toBe(4900);
    await server().from("plans").update({ price_minor: 0 }).eq("code", "start");
  });
});

describe("plan limits", () => {
  it("the Start plan allows 2 active staff; deactivated ones do not count", async () => {
    await server().from("tenants").update({ plan: "start" }).eq("id", B.id);
    const add = (name: string) =>
      B.owner.db.from("staff").insert({ tenant_id: B.id, display_name: name }).select("id").single();
    const s1 = await add("One");
    expect(s1.error).toBeNull();
    expect((await add("Two")).error).toBeNull();
    expect((await add("Three")).error?.code).toBe("P0006");
    await B.owner.db.from("staff").update({ active: false }).eq("id", s1.data!.id);
    expect((await add("Three")).error).toBeNull();
    expect((await B.owner.db.from("staff").update({ active: true }).eq("id", s1.data!.id)).error?.code).toBe(
      "P0006",
    );
  });
});

describe("deletion, trial end, export", () => {
  it("only the owner asks, with the exact name; can be cancelled", async () => {
    const { data: t } = await server().from("tenants").select("name").eq("id", A.id).single();
    expect(
      (await A.adminUser.db.rpc("request_tenant_deletion", { p_tenant: A.id, p_confirm_name: t!.name })).error
        ?.code,
    ).toBe("42501");
    expect(
      (await B.owner.db.rpc("request_tenant_deletion", { p_tenant: A.id, p_confirm_name: t!.name })).error
        ?.code,
    ).toBe("42501");
    expect(
      (await A.owner.db.rpc("request_tenant_deletion", { p_tenant: A.id, p_confirm_name: "wrong" })).error
        ?.code,
    ).toBe("22023");
    const due = (await A.owner.db.rpc("request_tenant_deletion", { p_tenant: A.id, p_confirm_name: t!.name }))
      .data as string;
    const days = (new Date(due).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);
    await A.owner.db.rpc("cancel_tenant_deletion", { p_tenant: A.id });
    expect(
      (await server().from("tenants").select("deletion_due_at").eq("id", A.id).single()).data!
        .deletion_due_at,
    ).toBeNull();
  });

  it("purge and trial end run only as the server", async () => {
    expect((await A.owner.db.rpc("purge_due_tenants")).error).not.toBeNull();
    expect((await A.owner.db.rpc("expire_trials")).error).not.toBeNull();

    const gone = await createTenant("p6gone", "salon");
    await server()
      .from("tenants")
      .update({ deletion_due_at: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", gone.id);
    expect((await server().rpc("purge_due_tenants")).data).toBeGreaterThanOrEqual(1);
    expect((await server().from("tenants").select("id").eq("id", gone.id)).data).toEqual([]);

    await server()
      .from("tenants")
      .update({ status: "trial", trial_ends_at: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", B.id);
    await server().rpc("expire_trials");
    expect((await server().from("tenants").select("status").eq("id", B.id).single()).data!.status).toBe(
      "past_due",
    );
  });

  it("only the owner exports the whole business", async () => {
    const r = await A.owner.db.rpc("export_tenant", { p_tenant: A.id });
    expect(r.error).toBeNull();
    expect(Object.keys(r.data as object)).toEqual(
      expect.arrayContaining(["business", "clients", "bookings", "payments"]),
    );
    expect((await A.adminUser.db.rpc("export_tenant", { p_tenant: A.id })).error?.code).toBe("42501");
    expect((await B.owner.db.rpc("export_tenant", { p_tenant: A.id })).error?.code).toBe("42501");
  });
});

describe("business photos", () => {
  it("owner/admin add photos only into their own folder; others cannot see them", async () => {
    const ok = await A.adminUser.db
      .from("business_photos")
      .insert({ tenant_id: A.id, path: `${A.id}/a.jpg` });
    expect(ok.error).toBeNull();
    expect(
      (await A.adminUser.db.from("business_photos").insert({ tenant_id: A.id, path: `${B.id}/a.jpg` })).error,
    ).not.toBeNull();
    expect(
      (await A.staff.db.from("business_photos").insert({ tenant_id: A.id, path: `${A.id}/s.jpg` })).error,
    ).not.toBeNull();
    expect(
      (await B.owner.db.from("business_photos").insert({ tenant_id: A.id, path: `${A.id}/b.jpg` })).error,
    ).not.toBeNull();
    expect((await B.owner.db.from("business_photos").select("id").eq("tenant_id", A.id)).data).toEqual([]);
  });
});
