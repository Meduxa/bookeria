"use client";

import { CalendarDays, LayoutDashboard, Menu, Scissors, Stethoscope, Users, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type BusinessType = "salon" | "dental";

function items(type: BusinessType) {
  return [
    { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, mobile: true },
    { href: "/calendar", key: "calendar", icon: CalendarDays, mobile: true },
    { href: "/clients", key: type === "dental" ? "patients" : "clients", icon: Users, mobile: true },
    { href: "/services", key: "services", icon: type === "dental" ? Stethoscope : Scissors, mobile: true },
    { href: "/settings/team", key: "team", icon: UsersRound, mobile: false },
  ] as const;
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ type }: { type: BusinessType }) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  return (
    <nav aria-label={t("main")} className="flex flex-col gap-1">
      {items(type).map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            isActive(href) && "bg-muted text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}

// Phone: max 5 items, last one ("More") opens the rest.
export function BottomNav({ type }: { type: BusinessType }) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  const main = items(type).filter((i) => i.mobile);
  const all = [...main, { href: "/settings/team", key: "more", icon: Menu }] as const;

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {all.map(({ href, key, icon: Icon }) => (
          <li key={key}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.7rem] leading-tight text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive(href) && "font-medium text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="line-clamp-1 text-center">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
