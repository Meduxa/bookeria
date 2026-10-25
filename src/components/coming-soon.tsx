import { Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export async function ComingSoon({ section }: { section: string }) {
  const t = await getTranslations("placeholder");
  return (
    <>
      <PageHeader title={section} />
      <EmptyState icon={<Hammer />} title={t("title", { section })} description={t("body")} />
    </>
  );
}
