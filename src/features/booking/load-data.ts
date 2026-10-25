import "server-only";
import {
  addDaysStr,
  type EngineData,
  type HM,
  type ResourceData,
  type ServiceRequest,
  type StaffData,
} from "./engine/availability";
import type { Range } from "./engine/intervals";
import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ, trimSeconds } from "@/lib/time";
import { fromZonedTime } from "date-fns-tz";

type Db = Awaited<ReturnType<typeof createClient>>;

const range = (s: string, e: string): Range => [new Date(s).getTime(), new Date(e).getTime()];
const hm = (r: { start_time: string; end_time: string }): HM => ({
  start: trimSeconds(r.start_time),
  end: trimSeconds(r.end_time),
});

// Everything the engine needs for [fromDate, toDate] (local dates), one query
// per table. RLS applies: a staff member only sees their own bookings, which
// is enough because they only book themselves; the database constraint
// guards the rest.
export async function loadEngineData(
  db: Db,
  tenantId: string,
  fromDate: string,
  toDate: string,
  opts: { excludeBookingId?: string } = {},
): Promise<EngineData & { staffNames: Record<string, { name: string; color: string }> }> {
  const { data: tenant } = await db.from("tenants").select("timezone").eq("id", tenantId).single();
  const tz = tenant?.timezone ?? DEFAULT_TZ;
  const from = fromZonedTime(`${fromDate}T00:00`, tz).toISOString();
  const to = fromZonedTime(`${addDaysStr(toDate, 1)}T00:00`, tz).toISOString();

  const [settings, location, closures, staff, overrides, timeOff, staffServices, resources, items] =
    await Promise.all([
      db
        .from("tenant_settings")
        .select("min_notice_min, max_days_ahead, slot_step_min")
        .eq("tenant_id", tenantId)
        .single(),
      db
        .from("locations")
        .select("location_hours(weekday, start_time, end_time)")
        .eq("tenant_id", tenantId)
        .eq("is_primary", true)
        .single(),
      db.from("closures").select("date").eq("tenant_id", tenantId).gte("date", fromDate).lte("date", toDate),
      db
        .from("staff")
        .select(
          "id, display_name, color, sort_order, active, bookable_online, staff_schedules(weekday, start_time, end_time)",
        )
        .eq("tenant_id", tenantId),
      db
        .from("staff_schedule_overrides")
        .select("staff_id, date, is_day_off, start_time, end_time")
        .eq("tenant_id", tenantId)
        .gte("date", fromDate)
        .lte("date", toDate),
      db
        .from("time_off")
        .select("staff_id, starts_at, ends_at")
        .eq("tenant_id", tenantId)
        .lt("starts_at", to)
        .gt("ends_at", from),
      db
        .from("staff_services")
        .select("staff_id, service_id, duration_min_override")
        .eq("tenant_id", tenantId),
      db.from("resources").select("id, type, sort_order").eq("tenant_id", tenantId).eq("active", true),
      db
        .from("booking_items")
        .select("booking_id, staff_id, resource_id, starts_at, blocked_until")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .lt("starts_at", to)
        .gt("blocked_until", from),
    ]);

  const opening: Record<number, HM[]> = {};
  for (const h of location.data?.location_hours ?? []) (opening[h.weekday] ??= []).push(hm(h));

  const activeItems = (items.data ?? []).filter((i) => i.booking_id !== opts.excludeBookingId);
  const staffNames: Record<string, { name: string; color: string }> = {};

  const staffData: StaffData[] = (staff.data ?? []).map((s) => {
    staffNames[s.id] = { name: s.display_name, color: s.color };
    const week: Record<number, HM[]> = {};
    for (const w of s.staff_schedules) (week[w.weekday] ??= []).push(hm(w));
    const ov: StaffData["overrides"] = {};
    for (const o of (overrides.data ?? []).filter((x) => x.staff_id === s.id)) {
      if (o.is_day_off) ov[o.date] = { dayOff: true };
      else {
        const cur = ov[o.date];
        const list = cur && "intervals" in cur ? cur.intervals : [];
        ov[o.date] = {
          intervals: [...list, { start: trimSeconds(o.start_time!), end: trimSeconds(o.end_time!) }],
        };
      }
    }
    const services: StaffData["services"] = {};
    for (const x of (staffServices.data ?? []).filter((x) => x.staff_id === s.id))
      services[x.service_id] = { durationMin: x.duration_min_override };
    return {
      id: s.id,
      sortOrder: s.sort_order,
      active: s.active,
      bookableOnline: s.bookable_online,
      week,
      overrides: ov,
      timeOff: (timeOff.data ?? [])
        .filter((t) => t.staff_id === s.id)
        .map((t) => range(t.starts_at, t.ends_at)),
      busy: activeItems.filter((i) => i.staff_id === s.id).map((i) => range(i.starts_at, i.blocked_until)),
      services,
    };
  });

  const resourceData: ResourceData[] = (resources.data ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    sortOrder: r.sort_order,
    busy: activeItems.filter((i) => i.resource_id === r.id).map((i) => range(i.starts_at, i.blocked_until)),
  }));

  return {
    timeZone: tz,
    now: new Date(),
    rules: {
      minNoticeMin: settings.data?.min_notice_min ?? 120,
      maxDaysAhead: settings.data?.max_days_ahead ?? 60,
      slotStepMin: settings.data?.slot_step_min ?? 15,
    },
    openingHours: opening,
    closures: (closures.data ?? []).map((c) => c.date),
    staff: staffData,
    resources: resourceData,
    staffNames,
  };
}

// The engine's view of chosen services (service or variant time, add-ons).
export async function loadServiceRequests(
  db: Db,
  tenantId: string,
  picks: { serviceId: string; variantId?: string | null }[],
): Promise<ServiceRequest[] | null> {
  const ids = picks.map((p) => p.serviceId);
  const { data } = await db
    .from("services")
    .select(
      "id, duration_min, buffer_after_min, resource_type, bookable_online, active, service_variants(id, duration_min)",
    )
    .eq("tenant_id", tenantId)
    .in("id", ids);
  const out: ServiceRequest[] = [];
  for (const p of picks) {
    const s = data?.find((x) => x.id === p.serviceId);
    if (!s || !s.active) return null;
    const v = p.variantId ? s.service_variants.find((x) => x.id === p.variantId) : null;
    if (p.variantId && !v) return null;
    out.push({
      serviceId: s.id,
      durationMin: v?.duration_min ?? s.duration_min,
      bufferMin: s.buffer_after_min,
      resourceType: s.resource_type,
      bookableOnline: s.bookable_online,
    });
  }
  return out;
}
