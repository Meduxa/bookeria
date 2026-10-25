import { defineRouting } from "next-intl/routing";

export const locales = ["ka", "en", "ru"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ka",
  localePrefix: "always",
  // Georgian first: many Georgian users have English-language browsers, so
  // the browser's language is not a reliable signal. Switching is one click.
  localeDetection: false,
});
