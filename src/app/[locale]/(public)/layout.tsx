import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";

// Frame for pages clients see without signing in: online booking and manage links.
export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("publicBooking");

  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-end px-4 pt-3">
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-2 pb-10">{children}</main>
      <footer className="flex items-center justify-center gap-2 pb-6 text-xs text-muted-foreground">
        {t("poweredBy")}
        <BrandLogo className="h-5" />
      </footer>
    </div>
  );
}
