import { getTranslations, setRequestLocale } from "next-intl/server";
import { MoreNavList } from "@/components/app-shell/nav";
import { PageHeader } from "@/components/page-header";
import { InstallApp } from "@/components/pwa";
import { ThemeToggle } from "@/components/theme-toggle";
import { canManage, getActiveTenant } from "@/lib/tenant";

export default async function MorePage({ params }: PageProps<"/[locale]/more">) {
  setRequestLocale((await params).locale);
  const [t, tenant] = await Promise.all([getTranslations("nav"), getActiveTenant()]);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <PageHeader title={t("more")} />
      <MoreNavList canManage={!!tenant && canManage(tenant.role)} />
      <div className="rounded-xl border bg-card py-1">
        <InstallApp />
        <ThemeToggle />
      </div>
    </div>
  );
}
