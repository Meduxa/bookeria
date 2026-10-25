// Phase 1 tables: settings, locations, resources, services, staff, schedules,
// clients, consents. Same question as always: can a user of business A see or
// change anything of business B? And can staff do owner/admin work?
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type Db, type TestTenant } from "./helpers";

let A: TestTenant;
let B: TestTenant;
// ids of B's rows, created with the service key
const b: Record<string, string> = {};
// ids of A's rows
const a: Record<string, string> = {};

async function insertOne(db: Db, table: string, row: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from as any)(table).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id as string;
}

// a minimal valid row for each table, given ids of its parents in that tenant
function rows(tenantId: string, p: Record<string, string>): Record<string, Record<string, unknown>> {
  return {
    locations: { tenant_id: tenantId, name: "Second room" },
    location_hours: {
      tenant_id: tenantId,
      location_id: p.location,
      weekday: 7,
      start_time: "11:00",
      end_time: "15:00",
    },
    closures: { tenant_id: tenantId, date: "2027-01-07", reason: "Christmas" },
    resources: { tenant_id: tenantId, name: "Chair 1", type: "chair" },
    service_categories: { tenant_id: tenantId, name_i18n: { ka: "თმა" } },
    services: {
      tenant_id: tenantId,
      category_id: p.category,
      name_i18n: { ka: "შეჭრა" },
      price_minor: 5500,
      duration_min: 45,
    },
    service_variants: {
      tenant_id: tenantId,
      service_id: p.service,
      name_i18n: { ka: "გრძელი" },
      price_minor: 7000,
      duration_min: 60,
    },
    service_addons: {
      tenant_id: tenantId,
      service_id: p.service,
      name_i18n: { ka: "ნიღაბი" },
      price_minor: 1500,
      duration_min: 10,
    },
    staff: { tenant_id: tenantId, display_name: "Nino", color: "teal" },
    staff_services: {
      tenant_id: tenantId,
      staff_id: p.staff,
      service_id: p.service,
      price_minor_override: 6000,
    },
    staff_schedules: {
      tenant_id: tenantId,
      staff_id: p.staff,
      weekday: 1,
      start_time: "10:00",
      end_time: "14:00",
    },
    staff_schedule_overrides: {
      tenant_id: tenantId,
      staff_id: p.staff,
      date: "2027-01-02",
      is_day_off: true,
    },
    time_off: {
      tenant_id: tenantId,
      staff_id: p.staff,
      starts_at: "2027-02-01T08:00:00Z",
      ends_at: "2027-02-05T18:00:00Z",
      reason: "vacation",
    },
    clients: {
      tenant_id: tenantId,
      first_name: "ანა",
      phone_e164: `+99555${Math.floor(1000000 + Math.random() * 8999999)}`,
    },
  };
}

const CATALOG = [
  "locations",
  "location_hours",
  "closures",
  "resources",
  "service_categories",
  "services",
  "service_variants",
  "service_addons",
  "staff",
  "staff_services",
  "staff_schedules",
  "staff_schedule_overrides",
  "time_off",
] as const;

async function seedTenantRows(db: Db, tenantId: string, out: Record<string, string>) {
  const { data: loc } = await admin().from("locations").select("id").eq("tenant_id", tenantId).single();
  out.location = loc!.id;
  out.category = await insertOne(db, "service_categories", rows(tenantId, out).service_categories);
  out.service = await insertOne(db, "services", rows(tenantId, out).services);
  out.staff = await insertOne(db, "staff", rows(tenantId, out).staff);
  out.service_categories = out.category;
  out.services = out.service;
  for (const t of CATALOG) {
    if (!(t in out) && !["service_categories", "services", "staff"].includes(t)) {
      out[t] = await insertOne(db, t, rows(tenantId, out)[t]);
    }
  }
  out.client = await insertOne(db, "clients", rows(tenantId, out).clients);
}

beforeAll(async () => {
  A = await createTenant("p1a", "salon");
  B = await createTenant("p1b", "dental");
  await seedTenantRows(A.adminUser.db, A.id, a);
  await seedTenantRows(admin(), B.id, b);
});

afterAll(async () => {
  await cleanup();
});

describe("new businesses get defaults", () => {
  it("settings row and a primary location with opening hours exist", async () => {
    const { data: s } = await A.owner.db
      .from("tenant_settings")
      .select("slot_step_min")
      .eq("tenant_id", A.id);
    expect(s).toHaveLength(1);
    const { data: hours } = await A.owner.db
      .from("location_hours")
      .select("weekday")
      .eq("location_id", a.location);
    // defaults are Mon–Sat; the test setup above adds a Sunday row of its own
    expect(hours?.filter((h) => h.weekday <= 6).length).toBe(6);
  });
});

describe.each(CATALOG)("%s", (table) => {
  it("members of A see A's rows and none of B's", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = (db: Db) => (db.from as any)(table).select("id, tenant_id");
    const { data } = await from(A.staff.db);
    expect(data.length).toBeGreaterThan(0);
    expect(new Set(data.map((r: { tenant_id: string }) => r.tenant_id))).toEqual(new Set([A.id]));
    const { data: bRow } = await from(A.owner.db).eq("id", b[table] ?? b.location);
    expect(bRow).toEqual([]);
  });

  it("admin of A cannot insert into B", async () => {
    const row = rows(B.id, b)[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (A.adminUser.db.from as any)(table).insert(row);
    expect(error).not.toBeNull();
  });

  it("staff cannot insert, even into their own business", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (A.staff.db.from as any)(table).insert(rows(A.id, a)[table]);
    expect(error).not.toBeNull();
  });

  it("A cannot update or delete B's row", async () => {
    const id = b[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (db: Db) => (db.from as any)(table);
    const { data: upd } = await t(A.owner.db)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    expect(upd ?? []).toEqual([]);
    await t(A.owner.db).delete().eq("id", id);
    const { data: still } = await t(admin()).select("id").eq("id", id);
    expect(still).toHaveLength(1);
  });

  it("a row cannot be moved to another business", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin().from as any)(table).update({ tenant_id: B.id }).eq("id", a[table]);
    expect(error).not.toBeNull();
  });

  it("anonymous visitors see nothing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (anon().from as any)(table).select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("rows cannot point at another business's rows", () => {
  it("service in A with B's category", async () => {
    const { error } = await A.adminUser.db
      .from("services")
      .insert({ ...rows(A.id, a).services, category_id: b.category } as never);
    expect(error).not.toBeNull();
  });

  it("A's staff linked to B's service", async () => {
    const { error } = await A.adminUser.db
      .from("staff_services")
      .insert({ tenant_id: A.id, staff_id: a.staff, service_id: b.service });
    expect(error).not.toBeNull();
  });

  it("client in A preferring B's staff", async () => {
    const { error } = await A.adminUser.db
      .from("clients")
      .insert({ tenant_id: A.id, first_name: "X", preferred_staff_id: b.staff });
    expect(error).not.toBeNull();
  });
});

describe("tenant settings", () => {
  it("admin updates own settings; cannot touch B's; staff cannot change them", async () => {
    const { data: own } = await A.adminUser.db
      .from("tenant_settings")
      .update({ slot_step_min: 10 })
      .eq("tenant_id", A.id)
      .select("tenant_id");
    expect(own).toHaveLength(1);
    const { data: other } = await A.adminUser.db
      .from("tenant_settings")
      .update({ slot_step_min: 30 })
      .eq("tenant_id", B.id)
      .select("tenant_id");
    expect(other ?? []).toEqual([]);
    const { data: staff } = await A.staff.db
      .from("tenant_settings")
      .update({ slot_step_min: 60 })
      .eq("tenant_id", A.id)
      .select("tenant_id");
    expect(staff ?? []).toEqual([]);
  });

  it("nobody inserts or deletes settings rows", async () => {
    const del = await A.owner.db.from("tenant_settings").delete().eq("tenant_id", A.id).select("tenant_id");
    expect(del.data ?? []).toEqual([]);
    const { data } = await admin().from("tenant_settings").select("tenant_id").eq("tenant_id", A.id);
    expect(data).toHaveLength(1);
  });
});

describe("clients", () => {
  it("owner and admin see clients; staff see none by default", async () => {
    for (const u of [A.owner, A.adminUser]) {
      const { data } = await u.db.from("clients").select("id");
      expect(data?.map((c) => c.id)).toContain(a.client);
    }
    const { data } = await A.staff.db.from("clients").select("id");
    expect(data).toEqual([]);
  });

  it("staff see all clients when the business allows it", async () => {
    await A.owner.db.from("tenant_settings").update({ staff_sees_all_clients: true }).eq("tenant_id", A.id);
    const { data } = await A.staff.db.from("clients").select("id, tenant_id");
    expect(data?.map((c) => c.id)).toContain(a.client);
    expect(new Set(data?.map((c) => c.tenant_id))).toEqual(new Set([A.id]));
    await A.owner.db.from("tenant_settings").update({ staff_sees_all_clients: false }).eq("tenant_id", A.id);
  });

  it("A never sees B's clients", async () => {
    const { data } = await A.owner.db.from("clients").select("id").eq("id", b.client);
    expect(data).toEqual([]);
  });

  it("clients cannot be deleted directly", async () => {
    await A.owner.db.from("clients").delete().eq("id", a.client);
    const { data } = await admin().from("clients").select("id").eq("id", a.client);
    expect(data).toHaveLength(1);
  });

  it("the same phone cannot be added twice in one business", async () => {
    const { data: c } = await admin().from("clients").select("phone_e164").eq("id", a.client).single();
    const { error } = await A.adminUser.db
      .from("clients")
      .insert({ tenant_id: A.id, first_name: "Dup", phone_e164: c!.phone_e164 });
    expect(error?.code).toBe("23505");
  });
});

describe("consents", () => {
  it("admin records consent as themselves; history cannot be edited", async () => {
    const ok = await A.adminUser.db.from("client_consents").insert({
      tenant_id: A.id,
      client_id: a.client,
      channel: "sms",
      granted: true,
      source: "admin",
      recorded_by: A.adminUser.id,
    });
    expect(ok.error).toBeNull();
    const forged = await A.adminUser.db.from("client_consents").insert({
      tenant_id: A.id,
      client_id: a.client,
      channel: "email",
      granted: true,
      source: "admin",
      recorded_by: A.owner.id,
    });
    expect(forged.error).not.toBeNull();
    const upd = await A.owner.db
      .from("client_consents")
      .update({ granted: false })
      .eq("client_id", a.client)
      .select("id");
    expect(upd.error ?? upd.data?.length === 0).toBeTruthy();
  });

  it("current state comes from the latest event and stays inside the business", async () => {
    await A.adminUser.db.from("client_consents").insert({
      tenant_id: A.id,
      client_id: a.client,
      channel: "sms",
      granted: false,
      source: "client_request",
      recorded_by: A.adminUser.id,
    });
    const { data } = await A.owner.db.from("client_consent_state").select("client_id, channel, granted");
    expect(data?.find((r) => r.client_id === a.client && r.channel === "sms")?.granted).toBe(false);
    expect(data?.some((r) => r.client_id === b.client)).toBe(false);
  });

  it("A cannot write consent for B's client", async () => {
    const { error } = await A.adminUser.db.from("client_consents").insert({
      tenant_id: B.id,
      client_id: b.client,
      channel: "sms",
      granted: true,
      source: "admin",
      recorded_by: A.adminUser.id,
    });
    expect(error).not.toBeNull();
  });
});

describe("client data rights", () => {
  it("only the owner exports, only their own clients, and it is audited", async () => {
    expect((await A.adminUser.db.rpc("export_client", { p_client: a.client })).error?.code).toBe("42501");
    expect((await A.owner.db.rpc("export_client", { p_client: b.client })).error?.code).toBe("42501");
    const { data, error } = await A.owner.db.rpc("export_client", { p_client: a.client });
    expect(error).toBeNull();
    expect((data as { client: { id: string } }).client.id).toBe(a.client);
    const { data: log } = await A.owner.db.from("audit_log").select("action").eq("entity_id", a.client);
    expect(log?.map((l) => l.action)).toContain("client.exported");
  });

  it("merge keeps one card and moves consents; never across businesses", async () => {
    const dup = await insertOne(A.adminUser.db, "clients", {
      tenant_id: A.id,
      first_name: "ანა",
      email: "ana@example.test",
    });
    await A.adminUser.db.from("client_consents").insert({
      tenant_id: A.id,
      client_id: dup,
      channel: "email",
      granted: true,
      source: "admin",
      recorded_by: A.adminUser.id,
    });
    expect(
      (await A.adminUser.db.rpc("merge_clients", { p_keep: a.client, p_remove: b.client })).error,
    ).not.toBeNull();
    expect((await A.staff.db.rpc("merge_clients", { p_keep: a.client, p_remove: dup })).error).not.toBeNull();
    const { error } = await A.adminUser.db.rpc("merge_clients", { p_keep: a.client, p_remove: dup });
    expect(error).toBeNull();
    const { data: kept } = await admin().from("clients").select("email").eq("id", a.client).single();
    expect(kept?.email).toBe("ana@example.test");
    const { data: moved } = await admin()
      .from("client_consents")
      .select("client_id")
      .eq("channel", "email")
      .eq("tenant_id", A.id);
    expect(moved?.every((c) => c.client_id === a.client)).toBe(true);
  });

  it("only the owner anonymises; personal data and consents are gone", async () => {
    expect((await A.adminUser.db.rpc("anonymize_client", { p_client: a.client })).error?.code).toBe("42501");
    expect((await A.owner.db.rpc("anonymize_client", { p_client: b.client })).error?.code).toBe("42501");
    expect((await A.owner.db.rpc("anonymize_client", { p_client: a.client })).error).toBeNull();
    const { data: c } = await admin()
      .from("clients")
      .select("first_name, phone_e164, email, anonymized_at")
      .eq("id", a.client)
      .single();
    expect(c).toMatchObject({ phone_e164: null, email: null });
    expect(c?.anonymized_at).not.toBeNull();
    const { data: consents } = await admin().from("client_consents").select("id").eq("client_id", a.client);
    expect(consents).toEqual([]);
  });
});

describe("imports", () => {
  it("price list import works for A's admin, not into B, not for staff", async () => {
    const payload = [
      {
        category: "მანიკური",
        name: "კლასიკური მანიკური",
        price_type: "fixed",
        price_minor: 2000,
        price_max_minor: null,
        duration_min: 45,
      },
      {
        category: "მანიკური",
        name: "შილაკი",
        price_type: "from",
        price_minor: 3000,
        price_max_minor: null,
        duration_min: 60,
      },
      {
        category: "თმა",
        name: "აფრიკული ნაწნავები",
        price_type: "range",
        price_minor: 25000,
        price_max_minor: 30000,
        duration_min: 240,
      },
    ];
    expect(
      (await A.adminUser.db.rpc("import_services", { p_tenant: B.id, p_locale: "ka", p_rows: payload })).error
        ?.code,
    ).toBe("42501");
    expect(
      (await A.staff.db.rpc("import_services", { p_tenant: A.id, p_locale: "ka", p_rows: payload })).error
        ?.code,
    ).toBe("42501");
    const { data, error } = await A.adminUser.db.rpc("import_services", {
      p_tenant: A.id,
      p_locale: "ka",
      p_rows: payload,
    });
    expect(error).toBeNull();
    expect(data).toBe(3);
    const { data: cats } = await A.owner.db
      .from("service_categories")
      .select("name_i18n")
      .eq("tenant_id", A.id);
    expect(cats?.filter((c) => (c.name_i18n as { ka?: string }).ka === "მანიკური")).toHaveLength(1);
  });

  it("a bad row rolls back the whole price-list import", async () => {
    const before = (await admin().from("services").select("id").eq("tenant_id", A.id)).data!.length;
    const { error } = await A.adminUser.db.rpc("import_services", {
      p_tenant: A.id,
      p_locale: "ka",
      p_rows: [
        { category: null, name: "OK", price_type: "fixed", price_minor: 1000, duration_min: 30 },
        {
          category: null,
          name: "Bad",
          price_type: "range",
          price_minor: 3000,
          price_max_minor: 1000,
          duration_min: 30,
        },
      ],
    });
    expect(error).not.toBeNull();
    expect((await admin().from("services").select("id").eq("tenant_id", A.id)).data!.length).toBe(before);
  });

  it("client import skips existing phones and records consent from the file", async () => {
    const phone = `+99559${Math.floor(1000000 + Math.random() * 8999999)}`;
    const payload = [
      { first_name: "ნინო", phone_e164: phone, consent_sms: true },
      { first_name: "ნინო (again)", phone_e164: phone, consent_sms: true },
      { first_name: "გიორგი", phone_e164: null, email: "G@Example.test", consent_email: false },
    ];
    expect(
      (await A.adminUser.db.rpc("import_clients", { p_tenant: B.id, p_rows: payload })).error?.code,
    ).toBe("42501");
    const { data, error } = await A.adminUser.db.rpc("import_clients", { p_tenant: A.id, p_rows: payload });
    expect(error).toBeNull();
    expect(data).toEqual({ inserted: 2, skipped: 1 });
    const { data: c } = await admin().from("clients").select("id, source").eq("phone_e164", phone).single();
    expect(c?.source).toBe("import");
    const { data: consent } = await admin()
      .from("client_consents")
      .select("channel, source")
      .eq("client_id", c!.id);
    expect(consent).toEqual([{ channel: "sms", source: "import" }]);
  });
});

describe("staff photos", () => {
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });

  it("admin uploads into own folder only; staff cannot upload", async () => {
    const own = await A.adminUser.db.storage
      .from("staff-photos")
      .upload(`${A.id}/test-${Date.now()}.png`, png);
    expect(own.error).toBeNull();
    const other = await A.adminUser.db.storage
      .from("staff-photos")
      .upload(`${B.id}/x-${Date.now()}.png`, png);
    expect(other.error).not.toBeNull();
    const staff = await A.staff.db.storage.from("staff-photos").upload(`${A.id}/s-${Date.now()}.png`, png);
    expect(staff.error).not.toBeNull();
    await admin().storage.from("staff-photos").remove([own.data!.path]);
  });
});
