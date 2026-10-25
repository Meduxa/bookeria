import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Georgian } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { APP_NAME } from "@/lib/app";
import "../globals.css";

// Temporary fonts until Phase 2 picks the final ones from Figma.
const latin = Noto_Sans({ variable: "--font-latin", subsets: ["latin", "cyrillic"] });
const georgian = Noto_Sans_Georgian({ variable: "--font-georgian", subsets: ["georgian"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: { default: APP_NAME, template: `%s · ${APP_NAME}` }, description: t("description") };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${latin.variable} ${georgian.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
