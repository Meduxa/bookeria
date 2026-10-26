import "server-only";
import { addDaysStr } from "@/features/booking/engine/availability";
import { ymdIn } from "@/lib/date-format";
import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ } from "@/lib/time";
import { buildReport, canSeeMoney } from "./report";

type Db = Awaited<ReturnType<typeof createClient>>;

// The owner/admin home screen: today, this month so far, birthdays, SMS, first steps.
export async function getDashboard(db: Db, tenantId: string, role: string, locale: string) {
  const { data: tenant } = await db.from("tenants").select("timezone").eq("id", tenantId).single();
  const tz = tenant?.timezone ?? DEFAULT_TZ;
  const today = ymdIn(new Date().toISOString(), tz);
  const monthStart = `${today.slice(0, 8)}01`;

  // one report for the month so far; today is part of it
  const [month, money, balance, settings, clients, counts] = await Promise.all([
    buildReport(db, tenantId, { from: monthStart, to: today, locale }),
    canSeeMoney(db, tenantId, role),
    db.rpc("sms_balance", { p_tenant: tenantId }),
    db.from("tenant_settings").select("sms_low_balance").eq("tenant_id", tenantId).single(),
    db
      .from("clients")
      .select("id, first_name, last_name, birthday")
      .eq("tenant_id", tenantId)
      .is("anonymized_at", null)
      .not("birthday", "is", null)
      .limit(5000),
    Promise.all([
      db.from("services").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      db.from("staff").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      db.from("staff_schedules").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("source", "online"),
      db
        .from("sms_messages")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["sent", "delivered"]),
    ]),
  ]);

  // birthdays in the next 7 days (month-day match, the year does not matter)
  const next = Array.from({ length: 7 }, (_, i) => addDaysStr(today, i));
  const birthdays = (clients.data ?? [])
    .map((c) => {
      const md = c.birthday!.slice(5);
      const date = next.find((d) => d.slice(5) === md);
      return date ? { id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" "), date } : null;
    })
    .filter((x): x is { id: string; name: string; date: string } => !!x)
    .sort((a, b) => a.date.localeCompare(b.date));

  const [services, staff, schedules, online, sent] = counts;
  const smsBalance = (balance.data as number) ?? 0;
  return {
    today,
    money,
    todayBookings: month.bookings.activeByDay[today] ?? 0,
    todayReceivedMinor: month.money.byDay.find((d) => d.date === today)?.minor ?? 0,
    month: {
      receivedMinor: month.money.receivedMinor,
      occupancyPct: month.occupancyPct,
      newClients: month.clients.new,
      noShows: month.bookings.byStatus.no_show ?? 0,
    },
    birthdays,
    sms: { balance: smsBalance, low: smsBalance <= (settings.data?.sms_low_balance ?? 10) },
    checklist: {
      services: (services.count ?? 0) > 0,
      staff: (staff.count ?? 0) > 0,
      hours: (schedules.count ?? 0) > 0,
      link: (online.count ?? 0) > 0,
      sms: (sent.count ?? 0) > 0,
    },
  };
}
