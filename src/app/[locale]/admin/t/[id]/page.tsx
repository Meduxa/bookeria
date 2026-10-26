import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { TenantPlanForm, TopUpForm } from "@/features/platform/components/tenant-admin-forms";
import { TENANT_TONE } from "@/features/platform/tone";
import { Link } from "@/i18n/navigation";
import { ymdIn } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  name: string;
  slug: string;
  type: string;
  plan: string;
  status: string;
  trial_ends_at: string;
  owner_email: string | null;
  sms_balance: number;
  staff_count: number;
  bookings_30d: number;
};

export default async function AdminTenantPage({ params }: PageProps<"/[locale]/admin/t/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const db = await createClient();
  const [{ data }, { data: plans }] = await Promise.all([
    db.rpc("admin_tenants"),
    db.from("plans").select("code, name").order("sort_order"),
  ]);
  const r = ((data ?? []) as Row[]).find((x) => x.id === id);
  if (!r) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/admin">
          <ArrowLeft aria-hidden />
          {t("platform.nav.businesses")}
        </Link>
      </Button>
      <PageHeader
        title={r.name}
        description={`${r.owner_email ?? "—"} · ${t(`businessType.${r.type as "salon"}`)} · ${t("platform.summary", { staff: r.staff_count, bookings: r.bookings_30d })}`}
        actions={
          <Button variant="outline" asChild className="h-11 md:h-9">
            <a href={`/${locale}/book/${r.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t("platform.bookingPage")}
            </a>
          </Button>
        }
      />
      <StatusPill tone={TENANT_TONE[r.status]} dot className="self-start">
        {t(`platform.status.${r.status as "trial"}`)}
      </StatusPill>
      <TenantPlanForm
        tenantId={r.id}
        plan={r.plan}
        status={r.status}
        trialEndsAt={ymdIn(r.trial_ends_at)}
        plans={plans ?? []}
      />
      <TopUpForm tenantId={r.id} balance={r.sms_balance} />
    </div>
  );
}
