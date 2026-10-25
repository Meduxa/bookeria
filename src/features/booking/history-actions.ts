"use server";

import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { memberContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DEFAULT_TZ } from "@/lib/time";

const uuid = z.uuid();

// Visits of one client, newest first (RLS: staff see only bookings with them).
export async function clientVisits(clientId: string) {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(clientId).success) return [];
  const { data: tenant } = await ctx.supabase
    .from("tenants")
    .select("timezone")
    .eq("id", ctx.tenant.tenantId)
    .single();
  const tz = tenant?.timezone ?? DEFAULT_TZ;
  const { data } = await ctx.supabase
    .from("bookings")
    .select(
      "id, starts_at, status, total_minor, booking_items(name_snapshot, staff_id, sort_order, staff(display_name))",
    )
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((b) => ({
    id: b.id,
    start: b.starts_at,
    date: formatInTimeZone(b.starts_at, tz, "yyyy-MM-dd"),
    time: formatInTimeZone(b.starts_at, tz, "HH:mm"),
    status: b.status,
    totalMinor: b.total_minor,
    services: [...b.booking_items].sort((x, y) => x.sort_order - y.sort_order).map((i) => i.name_snapshot),
    staff: [
      ...new Set(
        b.booking_items.map(
          (i) => (i.staff as unknown as { display_name: string } | null)?.display_name ?? "",
        ),
      ),
    ].join(", "),
  }));
}

// Dental treatment notes: the database allows only the owner and doctors, and
// logs every read. Loaded only when someone presses "show", never in passing.
export async function readDentalNotes(
  clientId: string,
): Promise<ActionResult<{ id: string; author: string; body: string; at: string }[]>> {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(clientId).success) return fail("notAllowed");
  const { data, error } = await ctx.supabase.rpc("read_dental_notes", { p_client: clientId });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");
  return ok((data ?? []).map((n) => ({ id: n.id, author: n.author_name, body: n.body, at: n.created_at })));
}

export async function addDentalNote(
  clientId: string,
  bookingId: string | null,
  body: string,
): Promise<ActionResult> {
  const ctx = await memberContext();
  const text = body.trim();
  if (!ctx || !uuid.safeParse(clientId).success || !text || text.length > 4000) return fail("invalidInput");
  if (bookingId && !uuid.safeParse(bookingId).success) return fail("invalidInput");
  const { error } = await ctx.supabase.rpc("add_dental_note", {
    p_client: clientId,
    p_booking: bookingId as string,
    p_body: text,
  });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");
  return ok(undefined);
}
