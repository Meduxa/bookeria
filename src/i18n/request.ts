import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_TZ } from "@/lib/time";
import { routing } from "./routing";

// `locale` is set when code asks for a language explicitly (background jobs,
// SMS in the business's language); otherwise it comes from the URL.
export default getRequestConfig(async ({ requestLocale, locale: explicit }) => {
  const requested = explicit ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    timeZone: DEFAULT_TZ,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
