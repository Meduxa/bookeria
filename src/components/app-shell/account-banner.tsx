import { TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { fullDate, ymdIn } from "@/lib/date-format";
import { canManage, isReadOnly, type TenantMembership } from "@/lib/tenant";

const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

// Trial ending, payment due, read-only, deletion scheduled — one line above every page.
export async function AccountBanner({ tenant }: { tenant: TenantMembership }) {
  const t = await getTranslations();
  const manager = canManage(tenant.role);
  let text: string | null = null;
  let href: string | null = null;

  if (tenant.deletionDueAt && tenant.role === "owner") {
    text = t("account.deletion", { date: fullDate(t, ymdIn(tenant.deletionDueAt)) });
    href = "/settings/business";
  } else if (isReadOnly(tenant)) {
    text = t(`account.${tenant.status as "suspended"}`);
  } else if (tenant.status === "past_due" && manager) {
    text = t("account.pastDue");
  } else if (tenant.status === "trial" && manager) {
    const days = daysUntil(tenant.trialEndsAt);
    if (days <= 3) text = t("account.trialEnding", { days: Math.max(0, days) });
  }
  if (!text) return null;

  const body = (
    <>
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </>
  );
  const cls =
    "mb-4 flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning-ink";
  return href ? (
    <Link href={href} role="alert" className={`${cls} hover:underline`}>
      {body}
    </Link>
  ) : (
    <div role="alert" className={cls}>
      {body}
    </div>
  );
}
