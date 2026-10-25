import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ImportWizard } from "@/features/services/components/import-wizard";
import { Link } from "@/i18n/navigation";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/services/import">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "import" });
  return { title: t("title") };
}

export default async function ImportPage({ params }: PageProps<"/[locale]/services/import">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/services`);
  const t = await getTranslations();

  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/services">
          <ArrowLeft aria-hidden />
          {t("services.title")}
        </Link>
      </Button>
      <PageHeader title={t("import.title")} description={t("import.subtitle")} />
      <ImportWizard />
    </div>
  );
}
