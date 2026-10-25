import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AccountMenu } from "@/components/app-shell/account-menu";
import { BottomNav, SidebarNav } from "@/components/app-shell/nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { APP_NAME } from "@/lib/app";
import { requireUser } from "@/lib/auth";
import { getActiveTenant, getMyTenants } from "@/lib/tenant";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser(locale);
  const [active, tenants] = await Promise.all([getActiveTenant(), getMyTenants()]);
  if (!active) redirect(`/${locale}/onboarding`);

  const menu = (
    <AccountMenu
      user={{ fullName: user.fullName, email: user.email }}
      active={{ tenantId: active.tenantId, name: active.name, role: active.role }}
      tenants={tenants.map((t) => ({ tenantId: t.tenantId, name: t.name }))}
    />
  );

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-muted/30 p-3 md:flex">
        <div className="px-3 pt-2 text-lg font-semibold">{APP_NAME}</div>
        <SidebarNav type={active.type} />
        <div className="mt-auto flex flex-col gap-2">
          <LanguageSwitcher />
          {menu}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background px-4 py-2 md:hidden">
          <div className="min-w-0 flex-1">{menu}</div>
          <LanguageSwitcher />
        </header>
        <main className="flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">{children}</main>
      </div>

      <BottomNav type={active.type} />
    </div>
  );
}
