import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import QRCode from "qrcode";
import { AccountCard } from "@/features/settings/components/account-card";
import { SettingsView, type SettingsData } from "@/features/settings/components/settings-view";
import { ShareCard } from "@/features/settings/components/share-card";
import { fullDate, ymdIn } from "@/lib/date-format";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { trimSeconds } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/business">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "settings" });
  return { title: t("title") };
}

export default async function BusinessSettingsPage({ params }: PageProps<"/[locale]/settings/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);

  const supabase = await createClient();
  const id = tenant.tenantId;
  const [settings, location, closures, resources] = await Promise.all([
    supabase.from("tenant_settings").select("*").eq("tenant_id", id).single(),
    supabase
      .from("locations")
      .select("id, address, location_hours(weekday, start_time, end_time)")
      .eq("tenant_id", id)
      .eq("is_primary", true)
      .single(),
    supabase
      .from("closures")
      .select("id, date, reason")
      .eq("tenant_id", id)
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date"),
    supabase.from("resources").select("id, name, type").eq("tenant_id", id).order("sort_order").order("name"),
  ]);
  if (settings.error || location.error) throw new Error("Could not load settings");

  const s = settings.data;
  const hours: SettingsData["hours"] = {};
  for (const h of [...location.data.location_hours].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  )) {
    (hours[h.weekday] ??= []).push({ start: trimSeconds(h.start_time), end: trimSeconds(h.end_time) });
  }

  // language-neutral link: it opens in Georgian, clients can switch
  const url = `${publicEnv.NEXT_PUBLIC_APP_URL}/book/${tenant.slug}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <div className="flex flex-col gap-6">
      <ShareCard url={url} slug={tenant.slug} qrSvg={qrSvg} />
      <SettingsView
        data={{
          isOwner: tenant.role === "owner",
          isDental: tenant.type === "dental",
          business: {
            name: tenant.name,
            address: location.data.address ?? "",
            phone: s.phone ?? "",
            email: s.email ?? "",
          },
          rules: {
            minNoticeHours: Math.round(s.min_notice_min / 60),
            maxDaysAhead: s.max_days_ahead,
            cancelWindowHours: Math.round(s.cancel_window_min / 60),
            slotStepMin: s.slot_step_min,
            onlineRequiresApproval: s.online_requires_approval,
            onlineOtpRequired: s.online_otp_required,
            staffSeesAllClients: s.staff_sees_all_clients,
            staffSeesAllBookings: s.staff_sees_all_bookings,
            adminsSeeRevenue: s.admins_see_revenue,
          },
          hours,
          closures: closures.data ?? [],
          resources: (resources.data ?? []) as SettingsData["resources"],
        }}
      />
      {tenant.role === "owner" && (
        <AccountCard
          businessName={tenant.name}
          deletionDue={
            tenant.deletionDueAt ? fullDate(await getTranslations(), ymdIn(tenant.deletionDueAt)) : null
          }
        />
      )}
    </div>
  );
}
