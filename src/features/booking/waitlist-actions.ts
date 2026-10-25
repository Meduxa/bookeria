"use server";

import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { memberContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { localized } from "@/lib/i18n-text";
import { DEFAULT_TZ } from "@/lib/time";

export type WaitlistEntry = {
  id: string;
  client: { id: string; name: string; phone: string | null; importantNote: string | null; noShows: number };
  serviceId: string;
  serviceName: string;
  staffId: string | null;
  staffName: string | null;
  dateFrom: string;
  dateTo: string;
  timeFrom: string | null;
  timeTo: string | null;
  note: string | null;
};

const uuid = z.uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

export async function listWaitlist(): Promise<WaitlistEntry[]> {
  const ctx = await memberContext();
  if (!ctx) return [];
  const { data } = await ctx.supabase
    .from("waitlist")
    .select(
      "id, service_id, staff_id, date_from, date_to, time_from, time_to, note, clients(id, first_name, last_name, phone_e164, important_note, no_show_count), services(name_i18n), staff(display_name)",
    )
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("status", "waiting")
    .gte("date_to", new Date().toISOString().slice(0, 10))
    .order("date_from");
  return (data ?? []).map((w) => {
    const c = w.clients as unknown as {
      id: string;
      first_name: string;
      last_name: string | null;
      phone_e164: string | null;
      important_note: string | null;
      no_show_count: number;
    };
    return {
      id: w.id,
      client: {
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" "),
        phone: c.phone_e164,
        importantNote: c.important_note,
        noShows: c.no_show_count,
      },
      serviceId: w.service_id,
      serviceName: localized((w.services as unknown as { name_i18n: never }).name_i18n, ctx.locale),
      staffId: w.staff_id,
      staffName: (w.staff as unknown as { display_name: string } | null)?.display_name ?? null,
      dateFrom: w.date_from,
      dateTo: w.date_to,
      timeFrom: w.time_from?.slice(0, 5) ?? null,
      timeTo: w.time_to?.slice(0, 5) ?? null,
      note: w.note,
    };
  });
}

const addSchema = z.object({
  clientId: z.uuid(),
  serviceId: z.uuid(),
  staffId: z.uuid().nullable(),
  dateFrom: date,
  dateTo: date,
  timeFrom: time.nullable(),
  timeTo: time.nullable(),
  note: z.string().max(500).optional(),
});

export async function addToWaitlist(input: z.input<typeof addSchema>): Promise<ActionResult> {
  const ctx = await memberContext();
  const parsed = addSchema.safeParse(input);
  if (!ctx || !parsed.success || parsed.data.dateTo < parsed.data.dateFrom) return fail("invalidInput");
  const v = parsed.data;
  // staff add only for themselves (the database checks it too)
  const staffId = ctx.isManager ? v.staffId : ctx.staffId;
  const { error } = await ctx.supabase.rpc("add_to_waitlist", {
    p_tenant: ctx.tenant.tenantId,
    p_client: v.clientId,
    p_service: v.serviceId,
    p_staff: staffId as string,
    p_date_from: v.dateFrom,
    p_date_to: v.dateTo,
    p_time_from: v.timeFrom as string,
    p_time_to: v.timeTo as string,
    p_note: v.note ?? "",
  });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");
  revalidatePath(`/${ctx.locale}/calendar`);
  return ok(undefined);
}

export async function setWaitlistStatus(
  id: string,
  status: "booked" | "cancelled",
  bookingId?: string,
): Promise<ActionResult> {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(id).success || (bookingId && !uuid.safeParse(bookingId).success))
    return fail("invalidInput");
  const { error } = await ctx.supabase.rpc("set_waitlist_status", {
    p_entry: id,
    p_status: status,
    p_booking: bookingId as string,
  });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");
  revalidatePath(`/${ctx.locale}/calendar`);
  return ok(undefined);
}

// Who is waiting for the time a cancelled booking just freed: same service,
// same person (or anyone), the date inside their range, the time in their window.
export async function waitlistMatches(bookingId: string): Promise<string[]> {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(bookingId).success) return [];
  const [{ data: b }, { data: tz }] = await Promise.all([
    ctx.supabase
      .from("bookings")
      .select("starts_at, booking_items(service_id, staff_id)")
      .eq("id", bookingId)
      .single(),
    ctx.supabase.from("tenants").select("timezone").eq("id", ctx.tenant.tenantId).single(),
  ]);
  if (!b) return [];
  const zone = tz?.timezone ?? DEFAULT_TZ;
  const day = formatInTimeZone(b.starts_at, zone, "yyyy-MM-dd");
  const hm = formatInTimeZone(b.starts_at, zone, "HH:mm");
  const services = b.booking_items.map((i) => i.service_id).filter(Boolean) as string[];
  const staff = b.booking_items.map((i) => i.staff_id);
  const entries = await listWaitlist();
  return entries
    .filter(
      (w) =>
        services.includes(w.serviceId) &&
        (!w.staffId || staff.includes(w.staffId)) &&
        w.dateFrom <= day &&
        day <= w.dateTo &&
        (!w.timeFrom || w.timeFrom <= hm) &&
        (!w.timeTo || hm < w.timeTo),
    )
    .map((w) => w.id);
}
