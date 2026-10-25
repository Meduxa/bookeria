"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeInvite } from "../actions";

export function RevokeInviteButton({ id, email }: { id: string; email: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-11 text-destructive md:h-8"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("team.revokeConfirm", { email }))) return;
        startTransition(async () => {
          const result = await revokeInvite(id);
          if (result.ok) toast.success(t("team.revoked"));
          else toast.error(t(`errors.${result.error}`));
        });
      }}
    >
      {t("team.revoke")}
    </Button>
  );
}
