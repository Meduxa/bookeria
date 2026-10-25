"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function DashboardError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();
  return (
    <EmptyState
      icon={<TriangleAlert />}
      title={t("errors.pageTitle")}
      description={t("errors.pageBody")}
      action={<Button onClick={() => retry()}>{t("common.retry")}</Button>}
    />
  );
}
