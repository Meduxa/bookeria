import { Banknote, CalendarCheck, Download, Gauge, Receipt, UserPlus, UserX, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDaysStr } from "@/features/booking/engine/availability";
import { reportParams } from "@/features/reports/params";
import { buildReport, canSeeMoney } from "@/features/reports/report";
import { Link } from "@/i18n/navigation";
import { fullDate, ymdIn } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/reports">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "reports" });
  return { title: t("title") };
}

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const hours = (min: number) => (Math.round((min / 60) * 10) / 10).toString();

function Bars({ rows }: { rows: { label: string; value: number; shown: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-2 rounded-full bg-muted" aria-hidden>
            <span
              className="block h-2 rounded-full bg-primary"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="tabular-nums">{r.shown}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <Card className={`gap-4 p-4 md:p-6 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

export default async function ReportsPage({ params, searchParams }: PageProps<"/[locale]/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const t = await getTranslations();
  const L = (k: string, v?: Record<string, string | number>) => t(`reports.${k}` as "reports.title", v);
  const db = await createClient();
  const { data: tz } = await db.from("tenants").select("timezone").eq("id", tenant.tenantId).single();
  const today = ymdIn(new Date().toISOString(), tz?.timezone);
  const { from, to, staff } = reportParams(await searchParams, today);
  const [r, money, { data: staffList }] = await Promise.all([
    buildReport(db, tenant.tenantId, { from, to, staffId: staff, locale }),
    canSeeMoney(db, tenant.tenantId, tenant.role),
    db.from("staff").select("id, display_name").eq("tenant_id", tenant.tenantId).order("sort_order"),
  ]);

  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = addDaysStr(monthStart, -1);
  const presets = [
    { key: "thisMonth", from: monthStart, to: today },
    { key: "lastMonth", from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
    { key: "last30", from: addDaysStr(today, -29), to: today },
    { key: "thisYear", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
  const q = (f: string, tt: string) => `/reports?from=${f}&to=${tt}${staff ? `&staff=${staff}` : ""}`;
  const exportHref = `/api/export/report?from=${from}&to=${to}${staff ? `&staff=${staff}` : ""}&locale=${locale}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={L("title")}
        description={`${fullDate(t, from)} — ${fullDate(t, to)}`}
        actions={
          <Button asChild variant="outline" className="h-11 md:h-9">
            <a href={exportHref} download>
              <Download aria-hidden />
              {L("excel")}
            </a>
          </Button>
        }
      />

      <Card className="gap-3 p-4">
        <nav aria-label={L("period")} className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link
              key={p.key}
              href={q(p.from, p.to)}
              aria-current={p.from === from && p.to === to ? "page" : undefined}
              className="flex min-h-9 items-center rounded-full border px-3 text-sm hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >
              {L(`presets.${p.key}`)}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {L("from")}
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-11 rounded-lg border bg-background px-3 md:h-9"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {L("to")}
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-11 rounded-lg border bg-background px-3 md:h-9"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {L("staff")}
            <select
              name="staff"
              defaultValue={staff ?? ""}
              className="h-11 rounded-lg border bg-background px-3 md:h-9"
            >
              <option value="">{L("allStaff")}</option>
              {(staffList ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="h-11 md:h-9">
            {L("show")}
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {money && (
          <StatCard
            icon={<Banknote />}
            label={L("received")}
            value={formatMoney(r.money.receivedMinor)}
            hint={L("tipsHint", { tips: formatMoney(r.money.tipsMinor) })}
          />
        )}
        {money && (
          <StatCard
            icon={<Receipt />}
            label={L("averageTicket")}
            value={r.money.averageTicketMinor === null ? "—" : formatMoney(r.money.averageTicketMinor)}
          />
        )}
        <StatCard
          icon={<CalendarCheck />}
          label={L("visitsCompleted")}
          value={r.bookings.completed}
          hint={L("ofBookings", { count: r.bookings.total })}
        />
        <StatCard icon={<Gauge />} label={L("occupancy")} value={pct(r.occupancyPct)} />
        <StatCard
          icon={<UserX />}
          label={L("noShowRate")}
          value={pct(r.bookings.noShowRatePct)}
          tone="danger"
        />
        <StatCard
          icon={<XCircle />}
          label={L("cancellationRate")}
          value={pct(r.bookings.cancellationRatePct)}
          tone="warning"
        />
        <StatCard
          icon={<UserPlus />}
          label={L("newClients")}
          value={r.clients.new}
          hint={L("returningHint", { count: r.clients.returning })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {money && (
          <Section title={L("byDay")}>
            {r.money.byDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L("nothing")}</p>
            ) : (
              <Bars
                rows={r.money.byDay.map((d) => ({
                  label: fullDate(t, d.date).replace(/\s\d{4}$/, ""),
                  value: d.minor,
                  shown: formatMoney(d.minor),
                }))}
              />
            )}
          </Section>
        )}
        {money && (
          <Section title={L("byMethod")}>
            {r.money.byMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L("nothing")}</p>
            ) : (
              <Bars
                rows={r.money.byMethod.map((m) => ({
                  label: t(`checkout.methods.${m.method}` as "checkout.methods.cash"),
                  value: m.minor,
                  shown: formatMoney(m.minor),
                }))}
              />
            )}
            {r.money.byCategory.length > 0 && (
              <>
                <h3 className="pt-2 text-sm font-medium">{L("byCategory")}</h3>
                <Bars
                  rows={r.money.byCategory.map((c) => ({
                    label: c.name || L("noCategory"),
                    value: c.minor,
                    shown: formatMoney(c.minor),
                  }))}
                />
              </>
            )}
          </Section>
        )}

        <Section title={L("staffTitle")} wide>
          <div
            tabIndex={0}
            role="region"
            aria-label={L("staffTitle")}
            className="overflow-x-auto rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">{L("staff")}</th>
                  {money && <th className="py-2 pr-3 text-right font-medium">{L("serviceValue")}</th>}
                  {money && <th className="py-2 pr-3 text-right font-medium">{L("commission")}</th>}
                  <th className="py-2 pr-3 text-right font-medium">{L("bookedHours")}</th>
                  <th className="py-2 text-right font-medium">{L("occupancy")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.staff.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3">{s.name}</td>
                    {money && (
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(s.valueMinor)}</td>
                    )}
                    {money && (
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(s.commissionMinor)}</td>
                    )}
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {hours(s.bookedMinutes)} / {hours(s.workingMinutes)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{pct(s.occupancyPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {money && <p className="text-xs text-muted-foreground">{L("serviceValueHint")}</p>}
        </Section>

        <Section title={L("topServices")}>
          {r.topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L("nothing")}</p>
          ) : (
            <Bars
              rows={r.topServices.map((s) => ({
                label: s.name,
                value: s.count,
                shown: money ? `${s.count} · ${formatMoney(s.valueMinor)}` : String(s.count),
              }))}
            />
          )}
        </Section>

        <Section title={L("sourcesTitle")}>
          <Bars
            rows={Object.entries(r.bookings.bySource).map(([k, v]) => ({
              label: t(`booking.sources.${k}` as "booking.sources.admin"),
              value: v,
              shown: String(v),
            }))}
          />
          <h3 className="pt-2 text-sm font-medium">{L("statusTitle")}</h3>
          <Bars
            rows={Object.entries(r.bookings.byStatus).map(([k, v]) => ({
              label: t(`booking.status.${k}` as "booking.status.confirmed"),
              value: v,
              shown: String(v),
            }))}
          />
        </Section>

        <Section title={L("retentionTitle")}>
          <p className="text-sm text-muted-foreground">{L("retentionHint")}</p>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {(["d30", "d60", "d90"] as const).map((k) => (
              <div key={k} className="rounded-lg bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{L(`retention.${k}`)}</dt>
                <dd className="text-xl font-semibold tabular-nums">{pct(r.clients.retentionPct[k])}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}
