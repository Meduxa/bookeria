import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/features/auth/components/signup-form";
import { safeNext } from "@/features/auth/schema";
import { getCurrentUser } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth.signup" });
  return { title: t("title") };
}

export default async function SignupPage({ params, searchParams }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, email } = await searchParams;
  const target = safeNext(next, `/${locale}/onboarding`);
  if (await getCurrentUser()) redirect(target);

  const t = await getTranslations("auth.signup");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm next={target} defaultEmail={typeof email === "string" ? email : undefined} />
      </CardContent>
    </Card>
  );
}
