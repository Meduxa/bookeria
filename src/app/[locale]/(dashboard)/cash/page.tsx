import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Banknote, Coins, EyeOff } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { CashDatePicker } from "@/features/booking/components/cash-date-picker";
import { Link } from "@/i18n/navigation";
import { addDays } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/cash">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "cash" });
  return { title: t("title") };
}

export default async function CashPage({ params, searchParams }: PageProps<"/[locale]/cash">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const t = await getTranslations();
  const supabase = await createClient();
  const id = tenant.tenantId;

  const [{ data: tzRow }, { data: settings }] = await Promise.all([
    supabase.from("tenants").select("timezone").eq("id", id).single(),
    supabase.from("tenant_settings").select("admins_see_revenue").eq("tenant_id", id).single(),
  ]);
  if (tenant.role === "admin" && settings && !settings.admins_see_revenue) {
    return (
      <>
        <PageHeader title={t("cash.title")} />
        <EmptyState icon={<EyeOff />} title={t("cash.hidden")} />
      </>
    );
  }

  const tz = tzRow?.timezone ?? DEFAULT_TZ;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const sp = await searchParams;
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const from = fromZonedTime(`${day}T00:00`, tz).toISOString();
  const to = fromZonedTime(`${addDays(day, 1)}T00:00`, tz).toISOString();

  const [payments, done, unpaid, staff] = await Promise.all([
    supabase
      .from("payments")
      .select("id, booking_id, method, amount_minor, tip_minor, tip_staff_id, created_at")
      .eq("tenant_id", id)
      .eq("status", "paid")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at"),
    supabase
      .from("booking_items")
      .select("staff_id, price_minor_snapshot, bookings!inner(status)")
      .eq("tenant_id", id)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .eq("bookings.status", "completed"),
    supabase
      .from("bookings")
      .select("id, starts_at, total_minor, paid_minor, clients(first_name, last_name)")
      .eq("tenant_id", id)
      .in("status", ["arrived", "in_progress", "completed"])
      .gte("starts_at", fromZonedTime(`${addDays(today, -30)}T00:00`, tz).toISOString())
      .order("starts_at", { ascending: false })
      .limit(200),
    supabase.from("staff").select("id, display_name").eq("tenant_id", id),
  ]);

  const name = new Map((staff.data ?? []).map((s) => [s.id, s.display_name]));
  const rows = payments.data ?? [];
  const total = rows.reduce((s, p) => s + p.amount_minor, 0);
  const tips = rows.reduce((s, p) => s + p.tip_minor, 0);
  const byMethod = new Map<string, number>();
  for (const p of rows) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_minor);
  const byStaff = new Map<string, { services: number; tips: number }>();
  for (const i of done.data ?? []) {
    const cur = byStaff.get(i.staff_id) ?? { services: 0, tips: 0 };
    byStaff.set(i.staff_id, { ...cur, services: cur.services + i.price_minor_snapshot });
  }
  for (const p of rows.filter((p) => p.tip_staff_id && p.tip_minor)) {
    const cur = byStaff.get(p.tip_staff_id!) ?? { services: 0, tips: 0 };
    byStaff.set(p.tip_staff_id!, { ...cur, tips: cur.tips + p.tip_minor });
  }
  const open = (unpaid.data ?? []).filter((b) => b.paid_minor < b.total_minor);
  const time = (iso: string) => formatInTimeZone(iso, tz, "HH:mm");

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        title={t("cash.title")}
        description={t("cash.subtitle")}
        actions={<CashDatePicker value={day} label={t("cash.date")} />}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Banknote />}
          label={t("cash.total")}
          value={formatMoney(total)}
          hint={t("cash.count", { count: rows.length })}
        />
        <StatCard icon={<Coins />} tone="warning" label={t("cash.tips")} value={formatMoney(tips)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-2 p-4">
          <h2 className="text-sm font-semibold">{t("cash.byMethod")}</h2>
          {byMethod.size === 0 ? (
            <p className="text-sm text-muted-foreground">{t("cash.empty")}</p>
          ) : (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              {[...byMethod].map(([m, v]) => (
                <div key={m} className="contents">
                  <dt>{t(`checkout.methods.${m as "cash"}`)}</dt>
                  <dd className="text-right tabular-nums">{formatMoney(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
        <Card className="gap-2 p-4">
          <h2 className="text-sm font-semibold">{t("cash.byStaff")}</h2>
          {byStaff.size === 0 ? (
            <p className="text-sm text-muted-foreground">{t("cash.empty")}</p>
          ) : (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              {[...byStaff].map(([sid, v]) => (
                <div key={sid} className="contents">
                  <dt>{name.get(sid) ?? "—"}</dt>
                  <dd className="text-right tabular-nums">
                    {formatMoney(v.services)}
                    {v.tips > 0 && <span className="text-muted-foreground"> + {formatMoney(v.tips)}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <Card className="gap-2 p-4">
        <h2 className="text-sm font-semibold">{t("cash.payments")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("cash.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="w-12 tabular-nums">{time(p.created_at)}</span>
                <span className="flex-1">{t(`checkout.methods.${p.method as "cash"}`)}</span>
                <span className="tabular-nums">{formatMoney(p.amount_minor)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-2 p-4">
        <h2 className="text-sm font-semibold">{t("cash.unpaidTitle")}</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("cash.unpaidEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {open.map((b) => {
              const c = b.clients as unknown as { first_name: string; last_name: string | null } | null;
              const d = formatInTimeZone(b.starts_at, tz, "yyyy-MM-dd");
              return (
                <li key={b.id}>
                  <Link
                    href={`/calendar?view=list&date=${d}`}
                    className="flex items-center gap-3 py-2 hover:underline"
                  >
                    <span className="w-24 tabular-nums">
                      {d.slice(5).split("-").reverse().join(".")} {time(b.starts_at)}
                    </span>
                    <span className="flex-1">
                      {c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : t("calendar.walkIn")}
                    </span>
                    <span className="text-destructive-ink tabular-nums">
                      {formatMoney(b.total_minor - b.paid_minor)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
