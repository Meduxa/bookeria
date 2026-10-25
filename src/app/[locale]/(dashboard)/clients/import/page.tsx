import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ClientImportWizard } from "@/features/clients/components/client-import-wizard";
import { Link } from "@/i18n/navigation";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/clients/import">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "clientImport" });
  return { title: t("title") };
}

export default async function ClientImportPage({ params }: PageProps<"/[locale]/clients/import">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/clients`);
  const t = await getTranslations();
  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/clients">
          <ArrowLeft aria-hidden />
          {t(tenant.type === "dental" ? "clients.titleDental" : "clients.title")}
        </Link>
      </Button>
      <PageHeader title={t("clientImport.title")} description={t("clientImport.subtitle")} />
      <ClientImportWizard />
    </div>
  );
}
