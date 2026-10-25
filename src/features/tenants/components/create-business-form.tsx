"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Scissors, Stethoscope } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { createBusiness } from "../actions";
import { businessTypes, createBusinessSchema, type CreateBusinessInput } from "../schema";

const typeIcons = { salon: Scissors, dental: Stethoscope } as const;

export function CreateBusinessForm({ bookingBaseUrl }: { bookingBaseUrl: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [slugEdited, setSlugEdited] = useState(false);
  const form = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: { name: "", type: "salon", slug: "" },
  });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });
  const slug = useWatch({ control: form.control, name: "slug" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await createBusiness(values);
      if (result && !result.ok) {
        if (result.field === "slug") form.setError("slug", { message: result.error });
        else setFormError(result.error);
      }
    });
  });

  const nameField = form.register("name", {
    onChange: (e) => {
      if (!slugEdited) form.setValue("slug", slugify(e.target.value));
    },
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("onboarding.type")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {businessTypes.map((value) => {
            const Icon = typeIcons[value];
            return (
              <label
                key={value}
                className={cn(
                  "flex min-h-11 cursor-pointer gap-3 rounded-lg border p-3 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  type === value && "border-primary bg-muted",
                )}
              >
                <input type="radio" value={value} className="sr-only" {...form.register("type")} />
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{t(`businessType.${value}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`businessType.${value}Hint`)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("onboarding.name")}</Label>
        <Input
          id="name"
          className="h-11 md:h-9"
          placeholder={t("onboarding.namePlaceholder")}
          aria-invalid={!!errors.name}
          aria-describedby="name-error"
          {...nameField}
        />
        <FieldError id="name-error" code={errors.name?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">{t("onboarding.slug")}</Label>
        <Input
          id="slug"
          className="h-11 md:h-9"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!errors.slug}
          aria-describedby="slug-hint slug-error"
          {...form.register("slug", { onChange: () => setSlugEdited(true) })}
        />
        <p id="slug-hint" className="text-xs break-all text-muted-foreground">
          {t("onboarding.slugHint", { url: `${bookingBaseUrl}${slug || "…"}` })}
        </p>
        <FieldError id="slug-error" code={errors.slug?.message} />
      </div>

      <FieldError code={formError} />
      <Button type="submit" className="h-11 md:h-9" disabled={pending}>
        {pending ? t("onboarding.submit") + "…" : t("onboarding.submit")}
      </Button>
    </form>
  );
}
