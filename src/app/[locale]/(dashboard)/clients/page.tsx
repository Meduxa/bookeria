import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { getActiveTenant } from "@/lib/tenant";

export default async function ClientsPage({ params }: PageProps<"/[locale]/clients">) {
  setRequestLocale((await params).locale);
  const [t, tenant] = await Promise.all([getTranslations("nav"), getActiveTenant()]);
  return <ComingSoon section={t(tenant?.type === "dental" ? "patients" : "clients")} />;
}
