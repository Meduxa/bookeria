"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "../actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const t = useTranslations("invite");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <>
      <Button
        className="h-11 md:h-9"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvite(token);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {t("accept")}
      </Button>
      <FieldError code={error} />
    </>
  );
}
