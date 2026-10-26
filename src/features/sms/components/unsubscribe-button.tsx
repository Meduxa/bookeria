"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { unsubscribe } from "../manual-actions";

export function UnsubscribeButton({ unsubKey }: { unsubKey: string }) {
  const t = useTranslations("unsubscribe");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (done)
    return (
      <p role="status" className="flex items-center justify-center gap-2 font-medium text-success-ink">
        <Check className="size-4" aria-hidden />
        {t("done")}
      </p>
    );
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        className="h-11 md:h-9"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await unsubscribe(unsubKey);
            if (r.ok) setDone(true);
            else setError(r.error);
          })
        }
      >
        {t("confirm")}
      </Button>
      <FieldError code={error} />
    </div>
  );
}
