import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, type TestTenant } from "./helpers";

type W = { t: TestTenant; mine: string; other: string; service: string; client: string };
const at = (hhmm: string, day: string) => `${day}T${hhmm}:00+04:00`;

async function world(label: string): Promise<W> {
  const t = await createTenant(label, "salon");
  const db = admin();
  const staff = async (name: string) =>
    (await db.from("staff").insert({ tenant_id: t.id, display_name: name }).select("id").single()).data!.id;
  const mine = await staff("Mine");
  const other = await staff("Other");
  await db.from("memberships").update({ staff_id: mine }).eq("tenant_id", t.id).eq("user_id", t.staff.id);
  const service = (
    await db
      .from("services")
      .insert({ tenant_id: t.id, name_i18n: { ka: "მანიკური" }, price_minor: 4000, duration_min: 60 })
      .select("id")
      .single()
  ).data!.id;
  await db.from("staff_services").insert([
    { tenant_id: t.id, staff_id: mine, service_id: service },
    { tenant_id: t.id, staff_id: other, service_id: service },
  ]);
  const client = (
    await db
      .from("clients")
      .insert({
        tenant_id: t.id,
        first_name: "C",
        phone_e164: `+99557${Math.floor(1e6 + Math.random() * 8e6)}`,
      })
      .select("id")
      .single()
  ).data!.id;
  return { t, mine, other, service, client };
}

let A: W;
let B: W;
const occ = (w: W, staff: string, start: string) => [
  { service_id: w.service, staff_id: staff, starts_at: start },
];
const book = async (w: W, staff: string, start: string, who = w.t.adminUser) =>
  (
    await who.db.rpc("create_booking", {
      p_tenant: w.t.id,
      p_client: w.client,
      p_items: occ(w, staff, start),
    })
  ).data!;

beforeAll(async () => {
  A = await world("p3a");
  B = await world("p3b");
});
afterAll(async () => {
  await cleanup();
});

describe("recurring bookings", () => {
  it("creates every occurrence or none", async () => {
    const days = ["2032-01-05", "2032-01-12", "2032-01-19"];
    const ok = await A.t.adminUser.db.rpc("create_recurring_booking", {
      p_tenant: A.t.id,
      p_client: A.client,
      p_occurrences: days.map((d) => occ(A, A.mine, at("10:00", d))),
      p_every_weeks: 1,
    });
    expect(ok.error).toBeNull();
    const { data } = await admin().from("bookings").select("id").eq("recurrence_id", ok.data!);
    expect(data).toHaveLength(3);

    // second series clashes on its last date → nothing is created
    const clash = await A.t.adminUser.db.rpc("create_recurring_booking", {
      p_tenant: A.t.id,
      p_client: A.client,
      p_occurrences: ["2031-12-29", "2032-01-05"].map((d) => occ(A, A.mine, at("10:30", d))),
      p_every_weeks: 1,
    });
    expect(clash.error?.code).toBe("23P01");
    const { data: none } = await admin()
      .from("bookings")
      .select("id")
      .eq("tenant_id", A.t.id)
      .gte("starts_at", "2031-12-29")
      .lt("starts_at", "2031-12-30");
    expect(none).toEqual([]);
  });

  it("staff create series only for themselves", async () => {
    const r = await A.t.staff.db.rpc("create_recurring_booking", {
      p_tenant: A.t.id,
      p_client: A.client,
      p_occurrences: ["2032-02-02", "2032-02-09"].map((d) => occ(A, A.other, at("10:00", d))),
      p_every_weeks: 1,
    });
    expect(r.error?.code).toBe("42501");
  });

  it("cancel this and following leaves earlier ones", async () => {
    const days = ["2032-03-01", "2032-03-08", "2032-03-15"];
    const rec = (
      await A.t.adminUser.db.rpc("create_recurring_booking", {
        p_tenant: A.t.id,
        p_client: A.client,
        p_occurrences: days.map((d) => occ(A, A.other, at("12:00", d))),
        p_every_weeks: 1,
      })
    ).data!;
    const { data: list } = await admin()
      .from("bookings")
      .select("id, starts_at")
      .eq("recurrence_id", rec)
      .order("starts_at");
    const n = await A.t.adminUser.db.rpc("cancel_following", {
      p_booking: list![1].id,
      p_status: "cancelled_by_client",
    });
    expect(n.data).toBe(2);
    const { data: after } = await admin()
      .from("bookings")
      .select("status")
      .eq("recurrence_id", rec)
      .order("starts_at");
    expect(after!.map((b) => b.status)).toEqual(["confirmed", "cancelled_by_client", "cancelled_by_client"]);
    expect(
      (
        await B.t.owner.db.rpc("cancel_following", {
          p_booking: list![0].id,
          p_status: "cancelled_by_client",
        })
      ).error,
    ).not.toBeNull();
  });
});

describe("waitlist", () => {
  it("admin adds; staff see only their own entries; other businesses nothing", async () => {
    const add = (staff: string | null) =>
      A.t.adminUser.db.rpc("add_to_waitlist", {
        p_tenant: A.t.id,
        p_client: A.client,
        p_service: A.service,
        p_staff: staff as string,
        p_date_from: "2032-04-01",
        p_date_to: "2032-04-10",
        p_time_from: null as unknown as string,
        p_time_to: null as unknown as string,
        p_note: "",
      });
    expect((await add(A.mine)).error).toBeNull();
    expect((await add(A.other)).error).toBeNull();
    const { data: staffView } = await A.t.staff.db.from("waitlist").select("staff_id");
    expect(staffView!.map((w) => w.staff_id)).toEqual([A.mine]);
    expect((await B.t.owner.db.from("waitlist").select("id").eq("tenant_id", A.t.id)).data).toEqual([]);
    const intoA = await B.t.owner.db.rpc("add_to_waitlist", {
      p_tenant: A.t.id,
      p_client: A.client,
      p_service: A.service,
      p_staff: A.mine,
      p_date_from: "2032-04-01",
      p_date_to: "2032-04-02",
      p_time_from: null as unknown as string,
      p_time_to: null as unknown as string,
      p_note: "",
    });
    expect(intoA.error?.code).toBe("42501");
  });
});

describe("checkout and money", () => {
  it("split payment with discount, extra item and tip; booking completes", async () => {
    const id = await book(A, A.mine, at("10:00", "2032-05-03"));
    const r = await A.t.adminUser.db.rpc("checkout_booking", {
      p_booking: id,
      p_charges: [{ name: "შამპუნი", price_minor: 2000 }],
      p_discount_minor: 1000,
      p_payments: [
        { method: "cash", amount_minor: 3000 },
        { method: "card", amount_minor: 2000 },
      ],
      p_tip_minor: 500,
      p_tip_staff: null as unknown as string,
    });
    expect(r.error).toBeNull();
    const { data: b } = await admin()
      .from("bookings")
      .select("status, total_minor, paid_minor, discount_minor")
      .eq("id", id)
      .single();
    expect(b).toEqual({ status: "completed", total_minor: 5000, paid_minor: 5000, discount_minor: 1000 });
    const { data: p } = await admin()
      .from("payments")
      .select("method, amount_minor, tip_minor, tip_staff_id")
      .eq("booking_id", id)
      .order("created_at");
    expect(p).toEqual([
      { method: "cash", amount_minor: 3000, tip_minor: 500, tip_staff_id: A.mine },
      { method: "card", amount_minor: 2000, tip_minor: 0, tip_staff_id: null },
    ]);
  });

  it("a discount larger than the bill is refused; other businesses and other staff cannot check out", async () => {
    const id = await book(A, A.other, at("15:00", "2032-05-03"));
    const pay = (who: TestTenant["owner"], discount = 0) =>
      who.db.rpc("checkout_booking", {
        p_booking: id,
        p_charges: [],
        p_discount_minor: discount,
        p_payments: [{ method: "cash", amount_minor: 4000 }],
        p_tip_minor: 0,
        p_tip_staff: null as unknown as string,
      });
    expect((await pay(A.t.adminUser, 999999)).error).not.toBeNull();
    expect((await pay(B.t.owner)).error?.code).toBe("42501");
    expect((await pay(A.t.staff)).error?.code).toBe("42501");
    expect((await admin().from("payments").select("id").eq("booking_id", id)).data).toEqual([]);
  });

  it("revenue: owner sees all, admin unless hidden, staff only their own bookings", async () => {
    const otherId = await book(A, A.other, at("17:00", "2032-05-04"));
    await A.t.adminUser.db.rpc("checkout_booking", {
      p_booking: otherId,
      p_charges: [],
      p_discount_minor: 0,
      p_payments: [{ method: "cash", amount_minor: 4000 }],
      p_tip_minor: 0,
      p_tip_staff: null as unknown as string,
    });
    const count = async (who: TestTenant["owner"]) =>
      (await who.db.from("payments").select("booking_id")).data!.length;
    expect(await count(A.t.owner)).toBe(3);
    expect(await count(A.t.adminUser)).toBe(3);
    const staffRows = (await A.t.staff.db.from("payments").select("booking_id")).data!;
    expect(staffRows.length).toBe(2); // only the split payment on their own booking
    await admin().from("tenant_settings").update({ admins_see_revenue: false }).eq("tenant_id", A.t.id);
    expect(await count(A.t.adminUser)).toBe(0);
    expect(await count(A.t.owner)).toBe(3);
    expect((await B.t.owner.db.from("payments").select("id").eq("tenant_id", A.t.id)).data).toEqual([]);
    await admin().from("tenant_settings").update({ admins_see_revenue: true }).eq("tenant_id", A.t.id);
  });
});

describe("booking import", () => {
  it("imports valid rows, skips overlaps, creates clients by phone; staff cannot import", async () => {
    const phone = `+99559${Math.floor(1e6 + Math.random() * 8e6)}`;
    const row = (line: number, time: string) => ({
      line,
      first_name: "ნინო",
      last_name: "ახალი",
      phone_e164: phone,
      service_id: A.service,
      staff_id: A.mine,
      starts_at: at(time, "2032-06-07"),
      duration_min: 60,
      price_minor: 4000,
      name: "მანიკური",
      status: "confirmed",
    });
    expect(
      (await A.t.staff.db.rpc("import_bookings", { p_tenant: A.t.id, p_rows: [row(1, "10:00")] })).error
        ?.code,
    ).toBe("42501");
    const r = await A.t.adminUser.db.rpc("import_bookings", {
      p_tenant: A.t.id,
      p_rows: [row(2, "10:00"), row(3, "10:30")],
      p_file_name: "old.xlsx",
    });
    expect(r.error).toBeNull();
    expect(r.data).toEqual({ imported: 1, skipped: [{ line: 3, reason: "overlap" }] });
    const { data: c } = await admin().from("clients").select("id, source").eq("phone_e164", phone);
    expect(c).toEqual([{ id: c![0].id, source: "import" }]);
    expect(
      (await B.t.owner.db.rpc("import_bookings", { p_tenant: A.t.id, p_rows: [row(4, "12:00")] })).error
        ?.code,
    ).toBe("42501");
  });
});
