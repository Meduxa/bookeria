"use client";

import { Check, ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/actions";
import { switchTenant } from "@/features/tenants/actions";
import { Link } from "@/i18n/navigation";
import { initials } from "@/lib/initials";

type Props = {
  user: { fullName: string; email: string };
  active: { tenantId: string; name: string; role: "owner" | "admin" | "staff" };
  tenants: { tenantId: string; name: string }[];
};

export function AccountMenu({ user, active, tenants }: Props) {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto min-h-11 w-full justify-start gap-2 px-2 py-1.5 text-left">
          <Avatar className="size-8">
            <AvatarFallback>{initials(user.fullName, user.email)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{active.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.fullName || user.email} · {t(`roles.${active.role}`)}
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("common.switchBusiness")}
        </DropdownMenuLabel>
        {tenants.map((tenant) => (
          <DropdownMenuItem key={tenant.tenantId} onSelect={() => switchTenant(tenant.tenantId)}>
            <span className="flex-1 truncate">{tenant.name}</span>
            {tenant.tenantId === active.tenantId && <Check aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus aria-hidden />
            {t("onboarding.submit")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOut aria-hidden />
          {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
