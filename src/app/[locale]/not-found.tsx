import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <EmptyState
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          <Button asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
        }
      />
    </main>
  );
}
