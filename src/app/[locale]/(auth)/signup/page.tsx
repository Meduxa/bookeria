import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/features/auth/components/signup-form";
import { safeNext } from "@/features/auth/schema";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth.signup" });
  return { title: t("title") };
}

export default async function SignupPage({ params, searchParams }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const target = safeNext(next, `/${locale}/onboarding`);
  if (await getCurrentUser()) redirect(target);

  // Coming from an invite: prefill the invited email from the invite itself,
  // so the address never has to travel in the URL.
  const token = target.match(/^\/(?:ka|en|ru)\/invite\/([0-9a-f]{64})$/)?.[1];
  let email: string | undefined;
  if (token) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invitation", { p_token: token });
    if (data?.[0]?.status === "open") email = data[0].email;
  }

  const t = await getTranslations("auth.signup");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm next={target} defaultEmail={email} />
      </CardContent>
    </Card>
  );
}
