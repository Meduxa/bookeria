import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, type TestTenant } from "./helpers";

// Speed target from the roadmap: a busy day (15 staff, 150 bookings) loads in
// under a second. Times the calendar's bookings query through RLS, from this
// machine to the Frankfurt dev project, so network latency is included.
const DAY = "2032-04-14";
const SELECT =
  "id, status, source, recurrence_id, starts_at, ends_at, internal_note, total_minor, paid_minor, clients(id, first_name, last_name, phone_e164, important_note, no_show_count), booking_items(id, staff_id, resource_id, service_id, name_snapshot, price_minor_snapshot, price_type_snapshot, duration_min_snapshot, starts_at, ends_at, sort_order)";

let t: TestTenant;

beforeAll(async () => {
  t = await createTenant("perf", "salon");
  const db = admin();
  const { data: staff } = await db
    .from("staff")
    .insert(Array.from({ length: 15 }, (_, i) => ({ tenant_id: t.id, display_name: `Master ${i + 1}` })))
    .select("id");
  const { data: service } = await db
    .from("services")
    .insert({ tenant_id: t.id, name_i18n: { ka: "შეჭრა" }, price_minor: 5500, duration_min: 45 })
    .select("id")
    .single();
  const rows = staff!.flatMap((s, si) =>
    Array.from({ length: 10 }, (_, h) => ({
      line: si * 10 + h + 2,
      first_name: `Client${si}-${h}`,
      last_name: "",
      phone_e164: `+995599${String(si * 10 + h).padStart(6, "0")}`,
      service_id: service!.id,
      staff_id: s.id,
      starts_at: `${DAY}T${String(9 + h).padStart(2, "0")}:00:00+04:00`,
      duration_min: 45,
      price_minor: 5500,
      name: "შეჭრა",
      status: null,
    })),
  );
  const { data, error } = await t.owner.db.rpc("import_bookings", { p_tenant: t.id, p_rows: rows });
  expect(error).toBeNull();
  expect((data as { imported: number }).imported).toBe(150);
});

afterAll(async () => {
  await cleanup();
});

async function medianMs(run: () => Promise<unknown>) {
  await run(); // warm-up (connection, query plan)
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[2];
}

describe("calendar speed", () => {
  it("day view with 15 staff and 150 bookings loads in under a second", async () => {
    const load = () =>
      Promise.all([
        t.owner.db
          .from("staff")
          .select("id, display_name, position, color, photo_path")
          .eq("tenant_id", t.id),
        t.owner.db
          .from("bookings")
          .select(SELECT)
          .eq("tenant_id", t.id)
          .lt("starts_at", `${DAY}T23:59:59+04:00`)
          .gt("ends_at", `${DAY}T00:00:00+04:00`)
          .order("starts_at")
          .then((r) => {
            expect(r.error).toBeNull();
            expect(r.data).toHaveLength(150);
          }),
      ]);
    const ms = await medianMs(load);
    console.log(`calendar day load (median of 5): ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(1000);
  });
});
