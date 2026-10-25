import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("nav");
  return <ComingSoon section={t("services")} />;
}
