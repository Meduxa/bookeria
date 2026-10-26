import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SmsSettingsView } from "@/features/sms/components/sms-settings-view";
import { getSmsOverview } from "@/features/sms/queries";
import { TEMPLATE_TYPES, type TemplateType } from "@/features/sms/render";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/sms">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "smsSettings" });
  return { title: t("title") };
}

export default async function SmsSettingsPage({ params }: PageProps<"/[locale]/settings/sms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const t = await getTranslations("smsSettings");

  // the default texts in every language, for the editor's "back to default"
  const defaults = Object.fromEntries(
    await Promise.all(
      (["ka", "en", "ru"] as const).map(async (l) => {
        const d = await getTranslations({ locale: l, namespace: "smsTemplates" });
        return [l, Object.fromEntries(TEMPLATE_TYPES.map((type) => [type, d.raw(type) as string]))];
      }),
    ),
  ) as Record<"ka" | "en" | "ru", Record<TemplateType, string>>;

  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SmsSettingsView
        data={await getSmsOverview(tenant.tenantId)}
        defaults={defaults}
        businessName={tenant.name}
      />
    </div>
  );
}
