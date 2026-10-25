import { MailX } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "@/features/auth/actions";
import { AcceptInviteButton } from "@/features/team/components/accept-invite-button";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { robots: { index: false } };

export default async function InvitePage({ params }: PageProps<"/[locale]/invite/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const { data } = /^[0-9a-f]{64}$/.test(token)
    ? await supabase.rpc("get_invitation", { p_token: token })
    : { data: [] };
  const invite = data?.[0];

  if (!invite || invite.status !== "open") {
    const status = invite?.status ?? "notFound";
    return (
      <Card>
        <CardContent>
          <EmptyState icon={<MailX />} title={t("invite.title")} description={t(`invite.status.${status}`)} />
        </CardContent>
      </Card>
    );
  }

  const user = await getCurrentUser();
  const here = `/${locale}/invite/${token}`;
  const description = t("invite.body", {
    business: invite.business_name,
    email: invite.email,
    role: t(`roles.${invite.role}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("invite.title")}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!user && (
          <>
            <Button asChild className="h-11 md:h-9">
              <Link href={`/signup?next=${encodeURIComponent(here)}`}>{t("invite.signUp")}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href={`/login?next=${encodeURIComponent(here)}`}>{t("invite.signIn")}</Link>
            </Button>
          </>
        )}
        {user && user.email.toLowerCase() === invite.email && (
          <>
            <p className="text-sm text-muted-foreground">{t("invite.signedInAs", { email: user.email })}</p>
            <AcceptInviteButton token={token} />
          </>
        )}
        {user && user.email.toLowerCase() !== invite.email && (
          <>
            <p className="text-sm">{t("invite.wrongAccount", { email: invite.email })}</p>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="h-11 w-full md:h-9">
                {t("common.signOut")}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
