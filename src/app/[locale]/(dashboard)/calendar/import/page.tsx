import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BookingImportWizard } from "@/features/booking/components/booking-import-wizard";
import { getCatalog } from "@/features/services/queries";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/calendar/import">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "bookingImport" });
  return { title: t("title") };
}

export default async function BookingImportPage({ params }: PageProps<"/[locale]/calendar/import">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/calendar`);
  const t = await getTranslations();
  const supabase = await createClient();
  const [{ services }, { data: staff }] = await Promise.all([
    getCatalog(tenant.tenantId),
    supabase.from("staff").select("id, display_name").eq("tenant_id", tenant.tenantId),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/calendar">
          <ArrowLeft aria-hidden />
          {t("calendar.title")}
        </Link>
      </Button>
      <PageHeader title={t("bookingImport.title")} description={t("bookingImport.subtitle")} />
      <BookingImportWizard
        catalog={{
          services: services.map((s) => ({
            id: s.id,
            names: Object.values(s.name).filter(Boolean) as string[],
            durationMin: s.durationMin,
            priceMinor: s.priceMinor,
          })),
          staff: (staff ?? []).map((s) => ({ id: s.id, name: s.display_name })),
        }}
      />
    </div>
  );
}
