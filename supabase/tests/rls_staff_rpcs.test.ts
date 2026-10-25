import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, type TestTenant } from "./helpers";

let A: TestTenant;
let B: TestTenant;
let aStaff: string;
let bStaff: string;
let aService: string;
let bService: string;

beforeAll(async () => {
  A = await createTenant("sra", "salon");
  B = await createTenant("srb", "salon");
  const db = admin();
  const mk = async (tenant: string) => {
    const s = await db.from("staff").insert({ tenant_id: tenant, display_name: "M" }).select("id").single();
    const v = await db
      .from("services")
      .insert({ tenant_id: tenant, name_i18n: { ka: "S" }, price_minor: 1000, duration_min: 30 })
      .select("id")
      .single();
    return [s.data!.id, v.data!.id];
  };
  [aStaff, aService] = await mk(A.id);
  [bStaff, bService] = await mk(B.id);
});

afterAll(async () => {
  await cleanup();
});

describe("set_staff_schedule", () => {
  const week = [
    { weekday: 1, start_time: "10:00", end_time: "14:00" },
    { weekday: 1, start_time: "15:00", end_time: "20:00" },
  ];

  it("admin replaces own staff schedule; B and staff role are refused", async () => {
    expect(
      (await A.adminUser.db.rpc("set_staff_schedule", { p_staff: aStaff, p_rows: week })).error,
    ).toBeNull();
    const { data } = await admin().from("staff_schedules").select("weekday").eq("staff_id", aStaff);
    expect(data).toHaveLength(2);
    expect(
      (await A.adminUser.db.rpc("set_staff_schedule", { p_staff: bStaff, p_rows: week })).error,
    ).not.toBeNull();
    expect(
      (await A.staff.db.rpc("set_staff_schedule", { p_staff: aStaff, p_rows: [] })).error,
    ).not.toBeNull();
    expect((await admin().from("staff_schedules").select("id").eq("staff_id", aStaff)).data).toHaveLength(2);
  });

  it("overlapping intervals are rejected and nothing changes", async () => {
    const { error } = await A.adminUser.db.rpc("set_staff_schedule", {
      p_staff: aStaff,
      p_rows: [
        { weekday: 2, start_time: "10:00", end_time: "14:00" },
        { weekday: 2, start_time: "13:00", end_time: "18:00" },
      ],
    });
    expect(error?.code).toBe("23P01");
    expect((await admin().from("staff_schedules").select("id").eq("staff_id", aStaff)).data).toHaveLength(2);
  });
});

describe("set_staff_services", () => {
  it("links own services; another business's service is rejected atomically", async () => {
    const ok = await A.adminUser.db.rpc("set_staff_services", {
      p_staff: aStaff,
      p_rows: [{ service_id: aService, price_minor_override: 1500, duration_min_override: null }],
    });
    expect(ok.error).toBeNull();
    const bad = await A.adminUser.db.rpc("set_staff_services", {
      p_staff: aStaff,
      p_rows: [
        { service_id: aService, price_minor_override: null, duration_min_override: null },
        { service_id: bService, price_minor_override: null, duration_min_override: null },
      ],
    });
    expect(bad.error).not.toBeNull();
    const { data } = await admin()
      .from("staff_services")
      .select("price_minor_override")
      .eq("staff_id", aStaff);
    expect(data).toEqual([{ price_minor_override: 1500 }]);
  });
});

describe("link_staff_login", () => {
  it("links a member of the same business; never across businesses", async () => {
    const { data: m } = await admin()
      .from("memberships")
      .select("id")
      .eq("tenant_id", A.id)
      .eq("user_id", A.owner.id)
      .single();
    const { data: bm } = await admin()
      .from("memberships")
      .select("id")
      .eq("tenant_id", B.id)
      .eq("user_id", B.owner.id)
      .single();

    expect(
      (await A.adminUser.db.rpc("link_staff_login", { p_staff: aStaff, p_membership: bm!.id })).error,
    ).not.toBeNull();
    expect(
      (await A.staff.db.rpc("link_staff_login", { p_staff: aStaff, p_membership: m!.id })).error,
    ).not.toBeNull();
    expect(
      (await A.adminUser.db.rpc("link_staff_login", { p_staff: bStaff, p_membership: m!.id })).error,
    ).not.toBeNull();

    // owner can link their own login (owners often work as masters too)
    expect(
      (await A.owner.db.rpc("link_staff_login", { p_staff: aStaff, p_membership: m!.id })).error,
    ).toBeNull();
    const { data: linked } = await admin().from("memberships").select("staff_id").eq("id", m!.id).single();
    expect(linked?.staff_id).toBe(aStaff);
    const { data: current } = await A.owner.db.rpc("current_staff_id", { p_tenant: A.id });
    expect(current).toBe(aStaff);
  });
});

describe("set_location_hours", () => {
  it("admin replaces own opening hours; never another business's; staff cannot", async () => {
    const loc = async (tenant: string) =>
      (await admin().from("locations").select("id").eq("tenant_id", tenant).eq("is_primary", true).single())
        .data!.id;
    const [aLoc, bLoc] = [await loc(A.id), await loc(B.id)];
    const hours = [{ weekday: 7, start_time: "11:00", end_time: "16:00" }];
    expect(
      (await A.adminUser.db.rpc("set_location_hours", { p_location: aLoc, p_rows: hours })).error,
    ).toBeNull();
    expect((await admin().from("location_hours").select("weekday").eq("location_id", aLoc)).data).toEqual([
      { weekday: 7 },
    ]);
    expect(
      (await A.adminUser.db.rpc("set_location_hours", { p_location: bLoc, p_rows: hours })).error,
    ).not.toBeNull();
    expect(
      (await A.staff.db.rpc("set_location_hours", { p_location: aLoc, p_rows: [] })).error,
    ).not.toBeNull();
    expect((await admin().from("location_hours").select("id").eq("location_id", bLoc)).data).toHaveLength(6);
  });
});
