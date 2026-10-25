"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localized } from "@/lib/i18n-text";
import { useFormat } from "@/lib/use-format";
import { deleteExtra, saveExtra } from "../actions";
import type { Extra } from "../queries";

// Variants (replace the base price/time) and add-ons (added on top).
export function ExtrasEditor({
  kind,
  serviceId,
  items,
}: {
  kind: "variant" | "addon";
  serviceId: string;
  items: Extra[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmt = useFormat();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [minutes, setMinutes] = useState(kind === "variant" ? "60" : "10");
  const base = kind === "variant" ? "variant" : "addon";

  const add = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveExtra(kind, serviceId, null, {
        name: { [locale]: name },
        price,
        durationMin: minutes,
      });
      if (!result.ok) return setError(result.error);
      setName("");
      setPrice("");
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">
          {t(kind === "variant" ? "services.variants" : "services.addons")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(kind === "variant" ? "services.variantsHint" : "services.addonsHint")}
        </p>
      </div>
      {items.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((x) => (
            <li key={x.id} className="flex min-h-11 items-center gap-2 px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 break-words">{localized(x.name, locale)}</span>
              <span className="text-muted-foreground tabular-nums">
                {kind === "addon" ? "+" : ""}
                {fmt.price({ priceType: "fixed", priceMinor: x.priceMinor, priceMaxMinor: null })}
                {x.durationMin > 0 && ` · ${fmt.duration(x.durationMin)}`}
              </span>
              <ConfirmDialog
                description={t("services.deleteConfirm", { name: localized(x.name, locale) })}
                onConfirm={() =>
                  startTransition(async () => {
                    const r = await deleteExtra(kind, x.id);
                    if (r.ok) toast.success(t("common.deleted"));
                    else toast.error(t(`errors.${r.error}`));
                  })
                }
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")} className="size-9">
                    <Trash2 aria-hidden />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_5rem_5rem_auto] items-end gap-2">
        <Input
          aria-label={t("services.fields.name")}
          placeholder={t("services.fields.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 md:h-9"
          id={`${base}-name`}
        />
        <Input
          aria-label={t("services.fields.price")}
          placeholder="₾"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-11 md:h-9"
        />
        <Input
          aria-label={t("services.fields.duration")}
          type="number"
          inputMode="numeric"
          min={0}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="h-11 md:h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 md:size-9"
          disabled={pending || !name.trim()}
          onClick={add}
          aria-label={t(kind === "variant" ? "services.addVariant" : "services.addAddon")}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      <FieldError code={error} />
    </section>
  );
}
