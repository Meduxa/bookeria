import {
  CalendarClock,
  ChevronRight,
  Circle,
  Link2,
  MessageSquare,
  Scissors,
  UsersRound,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { canManage, getActiveTenant } from "@/lib/tenant";

// where each first step is done; SMS arrives in Phase 5
const checklist = [
  { key: "services", icon: Scissors, href: "/services" },
  { key: "staff", icon: UsersRound, href: "/staff" },
  { key: "hours", icon: CalendarClock, href: "/settings/business" },
  { key: "link", icon: Link2, href: "/settings/business" },
  { key: "sms", icon: MessageSquare, href: null },
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
  const manager = !!tenant && canManage(tenant.role);

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
            {checklist.map(({ key, icon: Icon, href }) => {
              const row = (
                <>
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1 text-sm">{t(`dashboard.checklist.${key}`)}</span>
                  {href && manager ? (
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    !href && <Badge variant="secondary">{t("common.comingSoon")}</Badge>
                  )}
                </>
              );
              return (
                <li key={key}>
                  {href && manager ? (
                    <Link
                      href={href}
                      className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 py-2">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
