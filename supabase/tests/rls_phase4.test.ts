import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type Db, type TestTenant } from "./helpers";

// Phase 4: the public booking page. Visitors and signed-in users alike must not
// reach any of the new tables or functions; only the server (service_role) may.
type W = { t: TestTenant; staff: string; service: string; hidden: string };
const at = (hhmm: string, day: string) => `${day}T${hhmm}:00+04:00`;
const hash = () => randomBytes(16).toString("hex");
const phone = () => `+99559${Math.floor(1e6 + Math.random() * 8e6)}`;

async function world(label: string): Promise<W> {
  const t = await createTenant(label, "salon");
  const db = admin();
  const staff = (
    await db.from("staff").insert({ tenant_id: t.id, display_name: "Online" }).select("id").single()
  ).data!.id;
  const svc = async (online: boolean) =>
    (
      await db
        .from("services")
        .insert({
          tenant_id: t.id,
          name_i18n: { ka: "შეჭრა" },
          price_minor: 5000,
          duration_min: 60,
          bookable_online: online,
        })
        .select("id")
        .single()
    ).data!.id;
  const service = await svc(true);
  const hidden = await svc(false);
  await db.from("staff_services").insert([
    { tenant_id: t.id, staff_id: staff, service_id: service },
    { tenant_id: t.id, staff_id: staff, service_id: hidden },
  ]);
  return { t, staff, service, hidden };
}

let A: W;
let B: W;
const server = () => admin();

// a verified-phone pass, the way the server gets one
async function pass(w: W, ph: string) {
  const code = hash();
  const p = hash();
  await server().rpc("otp_issue", { p_tenant: w.t.id, p_phone: ph, p_code_hash: code });
  expect(
    (await server().rpc("otp_verify", { p_tenant: w.t.id, p_phone: ph, p_code_hash: code, p_pass_hash: p }))
      .data,
  ).toBe("ok");
  return p;
}

const create = (
  w: W,
  o: { phone: string; items: unknown; pass: string | null; token?: string; sms?: boolean },
  db: Db = server(),
) =>
  db.rpc("public_create_booking", {
    p_tenant: w.t.id,
    p_first_name: "Online",
    p_last_name: "Client",
    p_phone: o.phone,
    p_email: "online@example.test",
    p_comment: "first visit",
    p_items: o.items as never,
    p_marketing_sms: o.sms ?? false,
    p_marketing_email: false,
    p_locale: "ka",
    p_manage_token_hash: o.token ?? hash(),
    p_otp_pass_hash: o.pass as string,
  });
const item = (w: W, start: string, service = w.service, staff = w.staff) => [
  { service_id: service, staff_id: staff, starts_at: start },
];

beforeAll(async () => {
  A = await world("p4a");
  B = await world("p4b");
});
afterAll(async () => {
  await cleanup();
});

describe("nothing new for browsers", () => {
  it("visitors and members cannot read the new tables", async () => {
    for (const db of [anon(), A.t.owner.db]) {
      for (const table of ["otp_codes", "otp_passes", "rate_events", "booking_manage_tokens"] as const) {
        const { data, error } = await db.from(table).select("*");
        expect(error !== null || (data ?? []).length === 0, table).toBe(true);
      }
    }
  });

  it("visitors and members cannot call the public functions", async () => {
    for (const db of [anon(), A.t.owner.db]) {
      expect((await db.rpc("rate_hit", { p_key: "x", p_limit: 1, p_window_sec: 60 })).error).not.toBeNull();
      expect(
        (await db.rpc("otp_issue", { p_tenant: A.t.id, p_phone: phone(), p_code_hash: "h" })).error,
      ).not.toBeNull();
      expect(
        (
          await db.rpc("otp_verify", {
            p_tenant: A.t.id,
            p_phone: phone(),
            p_code_hash: "h",
            p_pass_hash: "p",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (await create(A, { phone: phone(), items: item(A, at("10:00", "2033-03-01")), pass: null }, db))
          .error,
      ).not.toBeNull();
      expect((await db.rpc("public_manage_view", { p_token_hash: "x" })).error).not.toBeNull();
      expect((await db.rpc("public_cancel_booking", { p_token_hash: "x" })).error).not.toBeNull();
    }
  });
});

describe("rate limits and SMS codes", () => {
  it("allows the limit, then refuses", async () => {
    const key = `test:${hash()}`;
    const hits = [];
    for (let i = 0; i < 4; i++)
      hits.push((await server().rpc("rate_hit", { p_key: key, p_limit: 3, p_window_sec: 3600 })).data);
    expect(hits).toEqual([true, true, true, false]);
  });

  it("a code dies after 5 wrong tries; codes are per business", async () => {
    const ph = phone();
    await server().rpc("otp_issue", { p_tenant: A.t.id, p_phone: ph, p_code_hash: "right" });
    const verify = (tenant: string, code: string) =>
      server().rpc("otp_verify", { p_tenant: tenant, p_phone: ph, p_code_hash: code, p_pass_hash: hash() });
    expect((await verify(B.t.id, "right")).data).toBe("expired"); // B has no code for this phone
    for (let i = 0; i < 5; i++) expect((await verify(A.t.id, "wrong")).data).toBe("wrong");
    expect((await verify(A.t.id, "right")).data).toBe("expired");
    // a fresh code works once
    await server().rpc("otp_issue", { p_tenant: A.t.id, p_phone: ph, p_code_hash: "again" });
    expect((await verify(A.t.id, "again")).data).toBe("ok");
    expect((await verify(A.t.id, "again")).data).toBe("expired");
  });
});

describe("public_create_booking", () => {
  it("needs a verified phone; the proof works once and only for that phone", async () => {
    const ph = phone();
    expect(
      (await create(A, { phone: ph, items: item(A, at("10:00", "2033-03-02")), pass: null })).error?.code,
    ).toBe("28000");
    const p = await pass(A, ph);
    expect(
      (await create(A, { phone: phone(), items: item(A, at("10:00", "2033-03-02")), pass: p })).error?.code,
    ).toBe("28000");
    expect(
      (await create(B, { phone: ph, items: item(B, at("10:00", "2033-03-02")), pass: p })).error?.code,
    ).toBe("28000");
    const ok = await create(A, { phone: ph, items: item(A, at("10:00", "2033-03-02")), pass: p, sms: true });
    expect(ok.error).toBeNull();
    expect(
      (await create(A, { phone: ph, items: item(A, at("12:00", "2033-03-02")), pass: p })).error?.code,
    ).toBe("28000");

    const res = ok.data as { booking_id: string; status: string; client_id: string };
    expect(res.status).toBe("confirmed");
    const { data: b } = await server()
      .from("bookings")
      .select("source, client_comment, total_minor")
      .eq("id", res.booking_id)
      .single();
    expect(b).toEqual({ source: "online", client_comment: "first visit", total_minor: 5000 });
    const { data: c } = await server()
      .from("clients")
      .select("source, phone_e164")
      .eq("id", res.client_id)
      .single();
    expect(c).toEqual({ source: "online", phone_e164: ph });
    const { data: consents } = await server()
      .from("client_consents")
      .select("channel, granted, source")
      .eq("client_id", res.client_id);
    expect(consents).toEqual([{ channel: "sms", granted: true, source: "booking_page" }]);
  });

  it("refuses hidden services, other businesses' staff, overlaps and blocked clients", async () => {
    const day = "2033-03-03";
    const try_ = async (items: unknown, ph = phone()) =>
      (await create(A, { phone: ph, items, pass: await pass(A, ph) })).error?.code;
    expect(await try_(item(A, at("10:00", day), A.hidden))).toBe("P0003");
    expect(await try_(item(A, at("10:00", day), A.service, B.staff))).toBe("P0003");
    expect(await try_(item(A, at("10:00", day)))).toBeUndefined();
    expect(await try_(item(A, at("10:30", day)))).toBe("23P01");

    const blocked = phone();
    await server()
      .from("clients")
      .insert({ tenant_id: A.t.id, first_name: "B", phone_e164: blocked, blocked_online: true });
    expect(await try_(item(A, at("14:00", day)), blocked)).toBe("P0004");
  });

  it("starts as pending when the business approves online bookings; no code needed when switched off", async () => {
    await server()
      .from("tenant_settings")
      .update({ online_requires_approval: true, online_otp_required: false })
      .eq("tenant_id", B.t.id);
    const r = await create(B, { phone: phone(), items: item(B, at("10:00", "2033-03-04")), pass: null });
    expect(r.error).toBeNull();
    expect((r.data as { status: string }).status).toBe("pending");
  });
});

describe("manage link", () => {
  it("shows, moves and cancels only with the token, and not inside the cancellation window", async () => {
    const ph = phone();
    const token = hash();
    const made = await create(A, {
      phone: ph,
      items: item(A, at("10:00", "2033-03-07")),
      pass: await pass(A, ph),
      token,
    });
    expect(made.error).toBeNull();
    const id = (made.data as { booking_id: string }).booking_id;

    expect((await server().rpc("public_manage_view", { p_token_hash: hash() })).data).toBeNull();
    const view = (await server().rpc("public_manage_view", { p_token_hash: token })).data as {
      booking_id: string;
      first_name: string;
    };
    expect(view).toMatchObject({ booking_id: id, first_name: "Online" });

    expect(
      (
        await server().rpc("public_move_booking", {
          p_token_hash: token,
          p_starts_at: at("15:00", "2033-03-07"),
        })
      ).error,
    ).toBeNull();
    const { data: moved } = await server()
      .from("booking_items")
      .select("starts_at")
      .eq("booking_id", id)
      .single();
    expect(new Date(moved!.starts_at).toISOString()).toBe(new Date(at("15:00", "2033-03-07")).toISOString());

    expect((await server().rpc("public_cancel_booking", { p_token_hash: token })).error).toBeNull();
    const { data: b } = await server().from("bookings").select("status").eq("id", id).single();
    expect(b!.status).toBe("cancelled_by_client");
    expect((await server().rpc("public_cancel_booking", { p_token_hash: token })).error?.code).toBe("P0001");
  });

  it("too late inside the cancellation window", async () => {
    const ph = phone();
    const token = hash();
    const soon = new Date(Date.now() + 60 * 60_000).toISOString(); // in 1 hour; window is 2+ hours by default
    await server().from("tenant_settings").update({ cancel_window_min: 120 }).eq("tenant_id", A.t.id);
    expect(
      (await create(A, { phone: ph, items: item(A, soon), pass: await pass(A, ph), token })).error,
    ).toBeNull();
    expect((await server().rpc("public_cancel_booking", { p_token_hash: token })).error?.code).toBe("P0005");
  });
});
