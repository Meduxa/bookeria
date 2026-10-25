import { defineRouting } from "next-intl/routing";

export const locales = ["ka", "en", "ru"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ka",
  localePrefix: "always",
});
