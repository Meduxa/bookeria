"use server";

import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DEFAULT_TZ } from "@/lib/time";

const rowSchema = z.object({
  line: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  phone: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/)
    .nullable(),
  serviceId: z.uuid(),
  serviceName: z.string().max(300),
  staffId: z.uuid(),
  durationMin: z.number().int().min(5).max(720),
  priceMinor: z.number().int().min(0).max(100_000_000),
  status: z.string().nullable(),
});

// Rows were parsed and matched in the browser; here they are re-validated, the
// local date/time becomes an instant in the business time zone, and the
// database imports them (no SMS is ever sent for imported bookings).
export async function importBookings(
  rows: unknown,
  fileName: string,
): Promise<ActionResult<{ imported: number; skipped: { line: number; reason: string }[] }>> {
  const ctx = await managerContext();
  const parsed = z.array(rowSchema).min(1).max(5000).safeParse(rows);
  if (!ctx || !parsed.success) return fail("invalidInput");
  const { data: tz } = await ctx.supabase
    .from("tenants")
    .select("timezone")
    .eq("id", ctx.tenant.tenantId)
    .single();
  const zone = tz?.timezone ?? DEFAULT_TZ;

  const { data: services } = await ctx.supabase
    .from("services")
    .select("id, name_i18n")
    .eq("tenant_id", ctx.tenant.tenantId);
  const nameOf = new Map(
    (services ?? []).map((s) => [
      s.id,
      (s.name_i18n as Record<string, string>)[ctx.locale] ||
        Object.values(s.name_i18n as Record<string, string>)[0],
    ]),
  );

  const { data, error } = await ctx.supabase.rpc("import_bookings", {
    p_tenant: ctx.tenant.tenantId,
    p_file_name: fileName.slice(0, 200),
    p_rows: parsed.data.map((r) => ({
      line: r.line,
      first_name: r.firstName,
      last_name: r.lastName,
      phone_e164: r.phone,
      service_id: r.serviceId,
      staff_id: r.staffId,
      starts_at: fromZonedTime(`${r.date}T${r.time}`, zone).toISOString(),
      duration_min: r.durationMin,
      price_minor: r.priceMinor,
      name: nameOf.get(r.serviceId) ?? r.serviceName,
      status: r.status,
    })),
  });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");
  revalidatePath(`/${ctx.locale}/calendar`);
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(data as { imported: number; skipped: { line: number; reason: string }[] });
}
