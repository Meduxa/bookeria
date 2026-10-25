import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCatalog } from "@/features/services/queries";
import { ServicesView } from "@/features/services/components/services-view";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "services" });
  return { title: t("title") };
}

export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  setRequestLocale((await params).locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { categories, services } = await getCatalog(tenant.tenantId);
  return (
    <ServicesView
      categories={categories}
      services={services}
      canManage={canManage(tenant.role)}
      isDental={tenant.type === "dental"}
    />
  );
}
