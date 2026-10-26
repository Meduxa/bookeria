import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { manageView } from "@/features/public-booking/actions";
import { ManageBooking } from "@/features/public-booking/components/manage-booking";
import { Link } from "@/i18n/navigation";

// The private link from the booking SMS. Never indexed by search engines.
export async function generateMetadata({ params }: PageProps<"/[locale]/m/[token]">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "manageBooking" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ManagePage({ params }: PageProps<"/[locale]/m/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("manageBooking");
  const view = await manageView(token);

  if (!view) {
    return (
      <Card className="gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("notFoundBody")}</p>
      </Card>
    );
  }

  const { tenantId: _t, bookingId: _b, ...visible } = view;
  void _t;
  void _b;

  return (
    <div className="flex flex-col gap-4">
      <ManageBooking token={token} view={visible} />
      <Button variant="link" asChild className="self-center">
        <Link href={`/book/${view.slug}`}>{t("bookAgain")}</Link>
      </Button>
    </div>
  );
}
