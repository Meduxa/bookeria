import { CalendarClock, Circle, Link2, MessageSquare, Scissors, UsersRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { canManage, getActiveTenant } from "@/lib/tenant";

const checklist = [
  { key: "services", icon: Scissors },
  { key: "staff", icon: UsersRound },
  { key: "hours", icon: CalendarClock },
  { key: "link", icon: Link2 },
  { key: "sms", icon: MessageSquare },
] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("dashboard") };
}

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, tenant] = await Promise.all([requireUser(locale), getActiveTenant()]);
  const t = await getTranslations();
  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? t("dashboard.welcome", { name: firstName }) : t("dashboard.welcomeNoName")}
        description={t("dashboard.subtitle", { business: tenant?.name ?? "" })}
        actions={
          tenant && canManage(tenant.role) ? (
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href="/settings/team">{t("dashboard.inviteTeam")}</Link>
            </Button>
          ) : null
        }
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("dashboard.checklistTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {checklist.map(({ key, icon: Icon }) => (
              <li key={key} className="flex min-h-12 items-center gap-3 py-2">
                <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-sm">{t(`dashboard.checklist.${key}`)}</span>
                <Badge variant="secondary">{t("common.comingSoon")}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
