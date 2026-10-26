import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { TENANT_TONE } from "@/features/platform/tone";
import { Link } from "@/i18n/navigation";
import { fullDate, ymdIn } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  name: string;
  slug: string;
  type: string;
  plan: string;
  status: string;
  trial_ends_at: string;
  deletion_due_at: string | null;
  staff_count: number;
  bookings_30d: number;
  sms_balance: number;
  last_activity: string | null;
  owner_email: string | null;
};

export default async function AdminHome({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { data } = await (await createClient()).rpc("admin_tenants");
  const rows = (data ?? []) as Row[];
  const date = (iso: string | null) => (iso ? fullDate(t, ymdIn(iso)) : "—");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("platform.nav.businesses")}
        description={t("platform.count", { count: rows.length })}
      />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 font-medium">{t("platform.cols.business")}</th>
              <th className="p-3 font-medium">{t("platform.cols.plan")}</th>
              <th className="p-3 font-medium">{t("platform.cols.status")}</th>
              <th className="p-3 text-right font-medium">{t("platform.cols.staff")}</th>
              <th className="p-3 text-right font-medium">{t("platform.cols.bookings30")}</th>
              <th className="p-3 text-right font-medium">{t("platform.cols.sms")}</th>
              <th className="p-3 font-medium">{t("platform.cols.lastActivity")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="p-3">
                  <Link href={`/admin/t/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {r.owner_email ?? "—"} · {t(`businessType.${r.type as "salon"}`)}
                  </span>
                </td>
                <td className="p-3">{r.plan}</td>
                <td className="p-3">
                  <StatusPill tone={TENANT_TONE[r.status]} dot>
                    {t(`platform.status.${r.status as "trial"}`)}
                  </StatusPill>
                  {r.status === "trial" && (
                    <span className="block text-xs text-muted-foreground">
                      {t("platform.until", { date: date(r.trial_ends_at) })}
                    </span>
                  )}
                  {r.deletion_due_at && (
                    <span className="block text-xs text-destructive">
                      {t("platform.deleting", { date: date(r.deletion_due_at) })}
                    </span>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">{r.staff_count}</td>
                <td className="p-3 text-right tabular-nums">{r.bookings_30d}</td>
                <td
                  className={`p-3 text-right tabular-nums ${r.sms_balance <= 10 ? "text-warning-ink" : ""}`}
                >
                  {r.sms_balance}
                </td>
                <td className="p-3 text-muted-foreground">{date(r.last_activity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
