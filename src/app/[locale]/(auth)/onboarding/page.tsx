import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateBusinessForm } from "@/features/tenants/components/create-business-form";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/[locale]/onboarding">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "onboarding" });
  return { title: t("title") };
}

// Reachable any time: a signed-in user can always create another business.
export default async function OnboardingPage({ params }: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, `/${locale}/onboarding`);

  const t = await getTranslations("onboarding");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <CreateBusinessForm
          bookingBaseUrl={`${publicEnv.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, "")}/book/`}
        />
      </CardContent>
    </Card>
  );
}
