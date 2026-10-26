import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingFlow } from "@/features/public-booking/components/booking-flow";
import { BusinessHeader } from "@/features/public-booking/components/business-header";
import { getPublicBusiness } from "@/features/public-booking/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/book/[slug]">) {
  const { locale, slug } = await params;
  const business = await getPublicBusiness(slug, locale);
  const t = await getTranslations({ locale, namespace: "publicBooking" });
  return { title: business ? `${business.name} — ${t("title")}` : t("notFoundTitle") };
}

export default async function PublicBookingPage({ params }: PageProps<"/[locale]/book/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const business = await getPublicBusiness(slug, locale);
  if (!business) notFound();
  const { tenantId: _id, ...visible } = business; // the browser needs no ids beyond the slug
  void _id;

  return (
    <div className="flex flex-col gap-4">
      <BookingFlow business={visible} header={<BusinessHeader business={visible} />} />
    </div>
  );
}
