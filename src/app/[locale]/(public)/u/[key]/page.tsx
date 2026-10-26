import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { UnsubscribeButton } from "@/features/sms/components/unsubscribe-button";
import { readUnsubscribeKey } from "@/features/sms/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

// From the link in a promotional SMS. Never indexed.
export async function generateMetadata({ params }: PageProps<"/[locale]/u/[key]">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "unsubscribe" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function UnsubscribePage({ params }: PageProps<"/[locale]/u/[key]">) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("unsubscribe");
  const clientId = readUnsubscribeKey(key);
  const { data } = clientId
    ? await createAdminClient().from("clients").select("tenants(name)").eq("id", clientId).maybeSingle()
    : { data: null };
  const business = (data?.tenants as unknown as { name: string } | null)?.name;

  return (
    <Card className="gap-4 p-6 text-center">
      {business ? (
        <>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("body", { business })}</p>
          <UnsubscribeButton unsubKey={key} />
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">{t("invalidTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("invalidBody")}</p>
        </>
      )}
    </Card>
  );
}
