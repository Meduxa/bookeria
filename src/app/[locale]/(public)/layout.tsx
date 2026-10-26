import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";

// Frame for pages clients see without signing in: online booking, manage links,
// unsubscribe, legal pages.
export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-end px-4 pt-3">
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-2 pb-10">{children}</main>
      <footer className="flex flex-col items-center gap-2 pb-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          {t("publicBooking.poweredBy")}
          <BrandLogo className="h-5" />
        </span>
        <nav aria-label={t("legal.links.privacy")} className="flex flex-wrap justify-center gap-x-4">
          <Link href="/legal/privacy" className="underline">
            {t("legal.links.privacy")}
          </Link>
          <Link href="/legal/terms" className="underline">
            {t("legal.links.terms")}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
