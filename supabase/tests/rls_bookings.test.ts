import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

type World = { t: TestTenant; staffMine: string; staffOther: string; service: string; client: string };

// A day far in the future so tests never collide with "now" rules.
const at = (hhmm: string, day = "2031-03-03") => `${day}T${hhmm}:00+04:00`;

async function world(label: string, type: "salon" | "dental"): Promise<World> {
  const t = await createTenant(label, type);
  const db = admin();
  const staff = async (name: string, positionType = "master") =>
    (
      await db
        .from("staff")
        .insert({ tenant_id: t.id, display_name: name, position_type: positionType })
        .select("id")
        .single()
    ).data!.id;
  const staffMine = await staff("Mine", type === "dental" ? "doctor" : "master");
  const staffOther = await staff("Other");
  await db
    .from("memberships")
    .update({ staff_id: staffMine })
    .eq("tenant_id", t.id)
    .eq("user_id", t.staff.id);
  const service = (
    await db
      .from("services")
      .insert({
        tenant_id: t.id,
        name_i18n: { ka: "შეჭრა" },
        price_minor: 5500,
        duration_min: 45,
        buffer_after_min: 15,
      })
      .select("id")
      .single()
  ).data!.id;
  await db.from("staff_services").insert([
    { tenant_id: t.id, staff_id: staffMine, service_id: service, price_minor_override: 6000 },
    { tenant_id: t.id, staff_id: staffOther, service_id: service },
  ]);
  const client = (
    await db
      .from("clients")
      .insert({
        tenant_id: t.id,
        first_name: "Client",
        phone_e164: `+99555${Math.floor(1e6 + Math.random() * 8e6)}`,
      })
      .select("id")
      .single()
  ).data!.id;
  return { t, staffMine, staffOther, service, client };
}

let A: World;
let B: World;
let D: World;

const book = (
  w: World,
  who: TestTenant["owner"],
  staffId: string,
  start: string,
  client: string | null = w.client,
) =>
  who.db.rpc("create_booking", {
    p_tenant: w.t.id,
    p_client: client as string,
    p_items: [{ service_id: w.service, staff_id: staffId, starts_at: start }],
  });

beforeAll(async () => {
  A = await world("bka", "salon");
  B = await world("bkb", "salon");
  D = await world("bkd", "dental");
});

afterAll(async () => {
  await cleanup();
});

describe("creating bookings", () => {
  it("admin books anyone; price and time are snapshotted on the server", async () => {
    const { data: id, error } = await book(A, A.t.adminUser, A.staffMine, at("10:00"));
    expect(error).toBeNull();
    const { data: item } = await admin().from("booking_items").select("*").eq("booking_id", id!).single();
    expect(item).toMatchObject({
      price_minor_snapshot: 6000,
      duration_min_snapshot: 45,
      buffer_min_snapshot: 15,
      name_snapshot: "შეჭრა",
    });
    expect(new Date(item!.blocked_until).toISOString()).toBe(new Date(at("11:00")).toISOString());
    const { data: b } = await admin().from("bookings").select("status, total_minor").eq("id", id!).single();
    expect(b).toEqual({ status: "confirmed", total_minor: 6000 });
  });

  it("staff book only for themselves", async () => {
    expect((await book(A, A.t.staff, A.staffMine, at("12:00"))).error).toBeNull();
    expect((await book(A, A.t.staff, A.staffOther, at("12:00"))).error?.code).toBe("42501");
  });

  it("the break after a service blocks the next slot; the end of the break does not", async () => {
    // A.staffMine is busy 10:00–10:45 + 15 min break
    expect((await book(A, A.t.adminUser, A.staffMine, at("10:50"))).error?.code).toBe("23P01");
    expect((await book(A, A.t.adminUser, A.staffMine, at("11:00"))).error).toBeNull();
  });

  it("two bookings for the same slot at the same moment: exactly one wins", async () => {
    const results = await Promise.all([
      book(A, A.t.owner, A.staffOther, at("15:00")),
      book(A, A.t.adminUser, A.staffOther, at("15:15")),
    ]);
    const ok = results.filter((r) => !r.error);
    expect(ok).toHaveLength(1);
    expect(results.find((r) => r.error)?.error?.code).toBe("23P01");
  });

  it("never across businesses: B's staff, service or client, or into B", async () => {
    expect((await book(A, A.t.adminUser, B.staffMine, at("09:00"))).error).not.toBeNull();
    expect((await book(A, A.t.adminUser, A.staffMine, at("09:00"), B.client)).error).not.toBeNull();
    const intoB = await A.t.adminUser.db.rpc("create_booking", {
      p_tenant: B.t.id,
      p_client: B.client,
      p_items: [{ service_id: B.service, staff_id: B.staffMine, starts_at: at("09:00") }],
    });
    expect(intoB.error?.code).toBe("42501");
    const mixed = await A.t.adminUser.db.rpc("create_booking", {
      p_tenant: A.t.id,
      p_client: A.client,
      p_items: [{ service_id: B.service, staff_id: A.staffMine, starts_at: at("09:00") }],
    });
    expect(mixed.error).not.toBeNull();
  });

  it("nobody writes the tables directly", async () => {
    const { error } = await A.t.owner.db
      .from("bookings")
      .insert({ tenant_id: A.t.id, starts_at: at("08:00"), ends_at: at("09:00") });
    expect(error).not.toBeNull();
    const upd = await A.t.owner.db
      .from("booking_items")
      .update({ price_minor_snapshot: 1 })
      .eq("tenant_id", A.t.id)
      .select("id");
    expect(upd.error ?? (upd.data?.length === 0 ? null : "updated")).not.toBe("updated");
  });
});

describe("seeing bookings", () => {
  it("staff see only their own; admin sees all; B and visitors see nothing", async () => {
    const { data: mine } = await A.t.staff.db.from("booking_items").select("staff_id");
    expect(mine!.length).toBeGreaterThan(0);
    expect(new Set(mine!.map((i) => i.staff_id))).toEqual(new Set([A.staffMine]));
    const { data: all } = await A.t.adminUser.db.from("booking_items").select("staff_id");
    expect(new Set(all!.map((i) => i.staff_id))).toEqual(new Set([A.staffMine, A.staffOther]));
    expect((await B.t.owner.db.from("bookings").select("id").eq("tenant_id", A.t.id)).data).toEqual([]);
    expect((await anon().from("bookings").select("id")).data ?? []).toEqual([]);
  });

  it("staff see all bookings when the business allows it", async () => {
    await admin().from("tenant_settings").update({ staff_sees_all_bookings: true }).eq("tenant_id", A.t.id);
    const { data } = await A.t.staff.db.from("booking_items").select("staff_id");
    expect(new Set(data!.map((i) => i.staff_id))).toEqual(new Set([A.staffMine, A.staffOther]));
    await admin().from("tenant_settings").update({ staff_sees_all_bookings: false }).eq("tenant_id", A.t.id);
  });

  it("staff see the clients they have a booking with", async () => {
    const { data } = await A.t.staff.db.from("clients").select("id");
    expect(data?.map((c) => c.id)).toContain(A.client);
  });
});

describe("moving and status", () => {
  it("staff cannot move another master's booking; can move their own; overlaps are refused", async () => {
    const other = (await book(A, A.t.adminUser, A.staffOther, at("17:00"))).data!;
    const otherItem = (await admin().from("booking_items").select("id").eq("booking_id", other).single())
      .data!.id;
    const denied = await A.t.staff.db.rpc("move_booking", {
      p_booking: other,
      p_items: [{ item_id: otherItem, staff_id: A.staffOther, starts_at: at("17:30") }],
    });
    expect(denied.error?.code).toBe("42501");

    const own = (await book(A, A.t.staff, A.staffMine, at("13:00"))).data!;
    const ownItem = (await admin().from("booking_items").select("id").eq("booking_id", own).single()).data!
      .id;
    const moved = await A.t.staff.db.rpc("move_booking", {
      p_booking: own,
      p_items: [{ item_id: ownItem, staff_id: A.staffMine, starts_at: at("14:00"), duration_min: 60 }],
    });
    expect(moved.error).toBeNull();
    const { data: item } = await admin()
      .from("booking_items")
      .select("starts_at, ends_at, blocked_until")
      .eq("id", ownItem)
      .single();
    expect(new Date(item!.ends_at).toISOString()).toBe(new Date(at("15:00")).toISOString());
    const { data: hist } = await admin()
      .from("booking_status_history")
      .select("reason")
      .eq("booking_id", own);
    expect(hist?.map((h) => h.reason)).toContain("rescheduled");

    const clash = await A.t.staff.db.rpc("move_booking", {
      p_booking: own,
      p_items: [{ item_id: ownItem, staff_id: A.staffMine, starts_at: at("10:30") }],
    });
    expect(clash.error?.code).toBe("23P01");
  });

  it("cancelling frees the slot; undo fails if someone took it meanwhile", async () => {
    const first = (await book(A, A.t.adminUser, A.staffOther, at("09:00", "2031-03-04"))).data!;
    expect(
      (
        await A.t.adminUser.db.rpc("set_booking_status", {
          p_booking: first,
          p_status: "cancelled_by_client",
          p_reason: "sick",
        })
      ).error,
    ).toBeNull();
    expect((await book(A, A.t.adminUser, A.staffOther, at("09:00", "2031-03-04"))).error).toBeNull();
    const undo = await A.t.adminUser.db.rpc("set_booking_status", {
      p_booking: first,
      p_status: "confirmed",
    });
    expect(undo.error?.code).toBe("23P01");
  });

  it("no-show counts on the client and can be undone; invalid jumps are refused", async () => {
    const id = (await book(A, A.t.adminUser, A.staffOther, at("11:00", "2031-03-05"))).data!;
    const count = async () =>
      (await admin().from("clients").select("no_show_count").eq("id", A.client).single()).data!.no_show_count;
    const before = await count();
    expect(
      (await A.t.adminUser.db.rpc("set_booking_status", { p_booking: id, p_status: "no_show" })).error,
    ).toBeNull();
    expect(await count()).toBe(before + 1);
    expect(
      (await A.t.adminUser.db.rpc("set_booking_status", { p_booking: id, p_status: "confirmed" })).error,
    ).toBeNull();
    expect(await count()).toBe(before);
    const jump = await A.t.adminUser.db.rpc("set_booking_status", { p_booking: id, p_status: "pending" });
    expect(jump.error?.code).toBe("P0001");
    const { data: hist } = await admin()
      .from("booking_status_history")
      .select("to_status")
      .eq("booking_id", id)
      .order("changed_at");
    expect(hist?.map((h) => h.to_status)).toEqual(["confirmed", "no_show", "confirmed"]);
  });

  it("B cannot change A's booking status", async () => {
    const id = (await book(A, A.t.adminUser, A.staffOther, at("12:00", "2031-03-05"))).data!;
    expect(
      (await B.t.owner.db.rpc("set_booking_status", { p_booking: id, p_status: "completed" })).error?.code,
    ).toBe("42501");
  });
});

describe("dental notes", () => {
  it("owner and doctor write and read (audited); admin, other businesses and salons cannot", async () => {
    const note = await D.t.owner.db.rpc("add_dental_note", {
      p_client: D.client,
      p_booking: null as unknown as string,
      p_body: "კბილი 36 — კარიესი",
    });
    expect(note.error).toBeNull();
    expect((await D.t.staff.db.rpc("read_dental_notes", { p_client: D.client })).data).toHaveLength(1);
    expect((await D.t.adminUser.db.rpc("read_dental_notes", { p_client: D.client })).error?.code).toBe(
      "42501",
    );
    expect((await A.t.owner.db.rpc("read_dental_notes", { p_client: D.client })).error?.code).toBe("42501");
    expect(
      (
        await A.t.owner.db.rpc("add_dental_note", {
          p_client: A.client,
          p_booking: null as unknown as string,
          p_body: "x",
        })
      ).error?.code,
    ).toBe("42501");
    expect((await D.t.owner.db.from("dental_notes").select("id")).error).not.toBeNull();
    const { data: log } = await admin()
      .from("audit_log")
      .select("action")
      .eq("tenant_id", D.t.id)
      .eq("action", "dental_notes.read");
    expect(log!.length).toBeGreaterThanOrEqual(1);
  });
});

describe("deleting a business with bookings", () => {
  it("works and removes everything", async () => {
    const id = A.t.id;
    expect((await admin().from("tenants").delete().eq("id", id)).error).toBeNull();
    expect((await admin().from("booking_items").select("id").eq("tenant_id", id)).data).toEqual([]);
  });
});
