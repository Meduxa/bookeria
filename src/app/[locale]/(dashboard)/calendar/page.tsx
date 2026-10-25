import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export default async function CalendarPage({ params }: PageProps<"/[locale]/calendar">) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("nav");
  return <ComingSoon section={t("calendar")} />;
}
