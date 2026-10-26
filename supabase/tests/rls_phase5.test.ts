import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// Phase 5: SMS queue, credits, templates, reminders.
type W = { t: TestTenant; staff: string; service: string; client: string; phone: string };
const key = () => `test:${randomBytes(8).toString("hex")}`;
const server = () => admin();

async function world(label: string): Promise<W> {
  const t = await createTenant(label, "salon");
  const db = admin();
  const staff = (await db.from("staff").insert({ tenant_id: t.id, display_name: "S" }).select("id").single())
    .data!.id;
  const service = (
    await db
      .from("services")
      .insert({ tenant_id: t.id, name_i18n: { ka: "შეჭრა" }, price_minor: 5000, duration_min: 60 })
      .select("id")
      .single()
  ).data!.id;
  await db.from("staff_services").insert({ tenant_id: t.id, staff_id: staff, service_id: service });
  const phone = `+99559${Math.floor(1e6 + Math.random() * 8e6)}`;
  const client = (
    await db
      .from("clients")
      .insert({ tenant_id: t.id, first_name: "C", phone_e164: phone })
      .select("id")
      .single()
  ).data!.id;
  return { t, staff, service, client, phone };
}

const enqueue = (w: W, o: { kind?: string; k?: string; segments?: number; type?: string } = {}) =>
  server().rpc("sms_enqueue", {
    p_tenant: w.t.id,
    p_to: w.phone,
    p_body: "hello",
    p_kind: o.kind ?? "service",
    p_type: o.type ?? "manual",
    p_key: o.k ?? key(),
    p_segments: o.segments ?? 1,
    p_client: w.client,
  });
const balance = async (w: W) => (await server().rpc("sms_balance", { p_tenant: w.t.id })).data as number;

let A: W;
let B: W;
beforeAll(async () => {
  A = await world("p5a");
  B = await world("p5b");
});
afterAll(async () => {
  await cleanup();
});

describe("who sees what", () => {
  it("every new business starts with 50 trial SMS; only its owner/admin can read the balance", async () => {
    expect((await A.t.owner.db.rpc("sms_balance", { p_tenant: A.t.id })).data).toBe(50);
    expect((await A.t.adminUser.db.rpc("sms_balance", { p_tenant: A.t.id })).data).toBe(50);
    expect((await A.t.staff.db.rpc("sms_balance", { p_tenant: A.t.id })).error?.code).toBe("42501");
    expect((await B.t.owner.db.rpc("sms_balance", { p_tenant: A.t.id })).error?.code).toBe("42501");
    expect((await anon().rpc("sms_balance", { p_tenant: A.t.id })).error).not.toBeNull();
  });

  it("the log is for owners/admins of that business; nobody writes messages or credits directly", async () => {
    await enqueue(A);
    expect((await A.t.adminUser.db.from("sms_messages").select("id")).data!.length).toBeGreaterThan(0);
    expect((await A.t.staff.db.from("sms_messages").select("id")).data).toEqual([]);
    expect((await B.t.owner.db.from("sms_messages").select("id").eq("tenant_id", A.t.id)).data).toEqual([]);
    expect((await anon().from("sms_messages").select("id")).data ?? []).toEqual([]);

    const ins = await A.t.owner.db.from("sms_messages").insert({
      tenant_id: A.t.id,
      to_phone: A.phone,
      body: "x",
      kind: "service",
      type: "manual",
      idempotency_key: key(),
      segments: 1,
    });
    expect(ins.error).not.toBeNull();
    expect(
      (
        await A.t.owner.db
          .from("sms_credit_ledger")
          .insert({ tenant_id: A.t.id, delta: 1000, reason: "topup" })
      ).error,
    ).not.toBeNull();
    expect((await B.t.owner.db.from("sms_credit_ledger").select("id").eq("tenant_id", A.t.id)).data).toEqual(
      [],
    );
  });

  it("members cannot call the sending functions", async () => {
    for (const db of [A.t.owner.db, anon()]) {
      expect((await db.rpc("sms_topup", { p_tenant: A.t.id, p_segments: 1000 })).error).not.toBeNull();
      expect((await db.rpc("sms_claim", { p_limit: 10 })).error).not.toBeNull();
      expect((await db.rpc("sms_due_reminders")).error).not.toBeNull();
      expect((await db.rpc("sms_unsubscribe", { p_client: A.client })).error).not.toBeNull();
      expect(
        (
          await db.rpc("sms_enqueue", {
            p_tenant: A.t.id,
            p_to: A.phone,
            p_body: "x",
            p_kind: "service",
            p_type: "manual",
            p_key: key(),
            p_segments: 1,
          })
        ).error,
      ).not.toBeNull();
    }
  });

  it("templates: owner/admin of the business only", async () => {
    const row = { tenant_id: A.t.id, type: "reminder", locale: "ka", body: "{business}: შეხსენება {time}" };
    expect((await A.t.staff.db.from("sms_templates").insert(row)).error).not.toBeNull();
    expect((await B.t.owner.db.from("sms_templates").insert(row)).error).not.toBeNull();
    expect((await A.t.adminUser.db.from("sms_templates").insert(row)).error).toBeNull();
    expect((await B.t.owner.db.from("sms_templates").select("id").eq("tenant_id", A.t.id)).data).toEqual([]);
  });

  it("a sender name waits for approval; members cannot approve it", async () => {
    await A.t.owner.db.from("tenant_settings").update({ sms_sender_name: "SalonA" }).eq("tenant_id", A.t.id);
    await A.t.owner.db
      .from("tenant_settings")
      .update({ sms_sender_status: "approved" })
      .eq("tenant_id", A.t.id);
    const { data } = await server()
      .from("tenant_settings")
      .select("sms_sender_name, sms_sender_status")
      .eq("tenant_id", A.t.id)
      .single();
    expect(data).toEqual({ sms_sender_name: "SalonA", sms_sender_status: "pending" });
    await server().from("tenant_settings").update({ sms_sender_status: "approved" }).eq("tenant_id", A.t.id);
    const after = await server()
      .from("tenant_settings")
      .select("sms_sender_status")
      .eq("tenant_id", A.t.id)
      .single();
    expect(after.data!.sms_sender_status).toBe("approved");
  });
});

describe("queue and credits", () => {
  it("the same key queues one message", async () => {
    const k = key();
    const a = await enqueue(B, { k });
    const b = await enqueue(B, { k });
    expect(a.data).toBe(b.data);
    expect((await server().from("sms_messages").select("id").eq("idempotency_key", k)).data).toHaveLength(1);
  });

  it("marketing only with SMS consent", async () => {
    const no = await enqueue(B, { kind: "marketing", type: "marketing" });
    expect(
      (await server().from("sms_messages").select("status, error_code").eq("id", no.data!).single()).data,
    ).toEqual({
      status: "skipped",
      error_code: "no_consent",
    });
    await server()
      .from("client_consents")
      .insert({ tenant_id: B.t.id, client_id: B.client, channel: "sms", granted: true, source: "admin" });
    const yes = await enqueue(B, { kind: "marketing", type: "marketing" });
    expect(
      (await server().from("sms_messages").select("status").eq("id", yes.data!).single()).data!.status,
    ).toBe("queued");
  });

  it("sending reserves credits; failure gives them back; temporary failures retry", async () => {
    const before = await balance(A);
    const id = (await enqueue(A, { segments: 2 })).data!;
    const claimed = (await server().rpc("sms_claim", { p_limit: 1, p_only: id })).data as { id: string }[];
    expect(claimed.map((m) => m.id)).toEqual([id]);
    expect(await balance(A)).toBe(before - 2);
    // claimed twice? no — it is no longer queued
    expect((await server().rpc("sms_claim", { p_limit: 1, p_only: id })).data).toEqual([]);

    await server().rpc("sms_finish", {
      p_id: id,
      p_ok: false,
      p_provider: "fake",
      p_ref: "",
      p_error: "timeout",
      p_retry: true,
    });
    expect(await balance(A)).toBe(before);
    expect((await server().from("sms_messages").select("status").eq("id", id).single()).data!.status).toBe(
      "queued",
    );

    await server().rpc("sms_claim", { p_limit: 1, p_only: id });
    await server().rpc("sms_finish", { p_id: id, p_ok: true, p_provider: "fake", p_ref: "r1" });
    expect(await balance(A)).toBe(before - 2);
    await server().rpc("sms_delivery", { p_provider: "fake", p_ref: "r1", p_delivered: true });
    expect((await server().from("sms_messages").select("status").eq("id", id).single()).data!.status).toBe(
      "delivered",
    );
  });

  it("without enough credits the message fails and nothing is taken", async () => {
    const left = await balance(B);
    const id = (await enqueue(B, { segments: 10 })).data!;
    await server().rpc("sms_topup", { p_tenant: B.t.id, p_segments: -left + 5 }); // leave 5
    expect((await server().rpc("sms_claim", { p_limit: 1, p_only: id })).data).toEqual([]);
    expect(
      (await server().from("sms_messages").select("status, error_code").eq("id", id).single()).data,
    ).toEqual({
      status: "failed",
      error_code: "no_credits",
    });
    expect(await balance(B)).toBe(5);
  });
});

describe("reminders and unsubscribe", () => {
  it("a 2-hour reminder is due once, not for bookings made too late", async () => {
    const soon = new Date(Date.now() + 90 * 60_000).toISOString();
    const { data: id } = await A.t.adminUser.db.rpc("create_booking", {
      p_tenant: A.t.id,
      p_client: A.client,
      p_items: [{ service_id: A.service, staff_id: A.staff, starts_at: soon }],
    });
    const due = async () =>
      ((await server().rpc("sms_due_reminders")).data as { booking_id: string; offset_min: number }[]).filter(
        (r) => r.booking_id === id,
      );
    expect(await due()).toEqual([]); // booked 1.5 h before: the 2-hour reminder is skipped

    await server()
      .from("bookings")
      .update({ created_at: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", id!);
    const rows = await due();
    expect(rows.map((r) => r.offset_min)).toEqual([120]);
    const { data: b } = await server().from("bookings").select("starts_at").eq("id", id!).single();
    const k = `reminder:120:${id}:${Math.floor(new Date(b!.starts_at).getTime() / 1000)}`;
    await enqueue(A, { k, type: "reminder" });
    expect(await due()).toEqual([]);
  });

  it("unsubscribe records a no, once", async () => {
    await server()
      .from("client_consents")
      .insert({ tenant_id: A.t.id, client_id: A.client, channel: "sms", granted: true, source: "admin" });
    await server().rpc("sms_unsubscribe", { p_client: A.client });
    await server().rpc("sms_unsubscribe", { p_client: A.client });
    const { data } = await server()
      .from("client_consents")
      .select("granted, source")
      .eq("client_id", A.client)
      .order("at");
    expect(data!.at(-1)).toEqual({ granted: false, source: "unsubscribe" });
    expect(data!.filter((c) => c.source === "unsubscribe")).toHaveLength(1);
  });
});
