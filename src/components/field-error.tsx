"use client";

import { useTranslations } from "next-intl";

// Zod and server actions return error codes; this turns them into text.
export function FieldError({ id, code }: { id?: string; code?: string }) {
  const t = useTranslations("errors");
  if (!code) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {t.has(code) ? t(code) : t("generic")}
    </p>
  );
}
