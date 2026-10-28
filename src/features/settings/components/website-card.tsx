"use client";

import { ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MAX_PHOTO_BYTES } from "../photo-limits";
import { SITE_THEMES, type SiteTheme, type WebsiteInput } from "../website";
import { saveWebsite, setWebsiteImage } from "../website-actions";

export type WebsiteData = WebsiteInput & { coverUrl: string | null; logoUrl: string | null };

const LOCALES = ["ka", "en", "ru"] as const;

// The business's own small website = the public booking page: cover, logo,
// about text, social links and a colour theme.
export function WebsiteCard({ tenantId, url, data }: { tenantId: string; url: string; data: WebsiteData }) {
  const t = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState<WebsiteInput>({
    about: data.about,
    instagram: data.instagram,
    facebook: data.facebook,
    theme: data.theme,
  });
  const [error, setError] = useState<{ code: string; field?: string }>();
  const [busy, setBusy] = useState<"cover" | "logo" | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = async (kind: "cover" | "logo", file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) return void toast.error(t("photos.tooBig"));
    setBusy(kind);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${tenantId}/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error: e } = await createClient()
        .storage.from("business-photos")
        .upload(path, file, { contentType: file.type });
      if (e) throw e;
      const r = await setWebsiteImage(kind, path);
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch {
      toast.error(t("errors.uploadFailed"));
    } finally {
      setBusy(null);
    }
  };

  const remove = (kind: "cover" | "logo") =>
    startTransition(async () => {
      const r = await setWebsiteImage(kind, null);
      if (!r.ok) return void toast.error(t(`errors.${r.error}` as "errors.generic"));
      router.refresh();
    });

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const r = await saveWebsite(form);
      if (!r.ok) return setError({ code: r.error, field: r.field });
      toast.success(t("common.saved"));
      router.refresh();
    });

  const image = (kind: "cover" | "logo", src: string | null) => (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t(`website.${kind}`)}</span>
      <div className="flex flex-wrap items-center gap-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own storage
          <img
            src={src}
            alt=""
            className={cn(
              "border object-cover",
              kind === "cover" ? "h-24 w-44 rounded-lg" : "size-16 rounded-full",
            )}
          />
        ) : (
          <span
            className={cn(
              "flex items-center justify-center border border-dashed text-muted-foreground",
              kind === "cover" ? "h-24 w-44 rounded-lg" : "size-16 rounded-full",
            )}
          >
            <ImagePlus className="size-5" aria-hidden />
          </span>
        )}
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50 md:h-9">
          {busy === kind ? "…" : src ? t("website.replace") : t("website.upload")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={!!busy}
            aria-label={t(`website.${kind}`)}
            onChange={(e) => {
              void upload(kind, e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {src && (
          <Button
            variant="ghost"
            className="h-11 md:h-9"
            disabled={pending}
            onClick={() => remove(kind)}
            aria-label={t("website.remove", { what: t(`website.${kind}`) })}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t(`website.${kind}Hint`)}</p>
    </div>
  );

  return (
    <Card className="gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base font-semibold">{t("website.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("website.hint")}</p>
        </div>
        <Button variant="outline" asChild className="h-11 md:h-9">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {t("website.view")}
          </a>
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {image("cover", data.coverUrl)}
        {image("logo", data.logoUrl)}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("website.theme")}</legend>
        <div role="radiogroup" aria-label={t("website.theme")} className="flex flex-wrap gap-3">
          {SITE_THEMES.map((th: SiteTheme) => (
            <button
              key={th}
              type="button"
              role="radio"
              aria-checked={form.theme === th}
              aria-label={t(`website.themes.${th}`)}
              data-site-theme={th}
              onClick={() => setForm((f) => ({ ...f, theme: th }))}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                form.theme === th && "border-primary bg-accent text-accent-foreground",
              )}
            >
              <span className="size-5 rounded-full bg-primary" aria-hidden />
              {t(`website.themes.${th}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">{t("website.about")}</span>
        {LOCALES.map((l) => (
          <FormField key={l} id={`about-${l}`} label={t(`languages.${l}`)}>
            <Textarea
              id={`about-${l}`}
              rows={3}
              maxLength={1000}
              value={form.about[l]}
              onChange={(e) => setForm((f) => ({ ...f, about: { ...f.about, [l]: e.target.value } }))}
            />
          </FormField>
        ))}
        <p className="text-xs text-muted-foreground">{t("website.aboutHint")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          id="site-instagram"
          label="Instagram"
          error={error?.field === "instagram" ? error.code : undefined}
        >
          <Input
            id="site-instagram"
            placeholder="@yoursalon"
            value={form.instagram}
            onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
          />
        </FormField>
        <FormField
          id="site-facebook"
          label="Facebook"
          error={error?.field === "facebook" ? error.code : undefined}
        >
          <Input
            id="site-facebook"
            placeholder="facebook.com/yoursalon"
            value={form.facebook}
            onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))}
          />
        </FormField>
      </div>

      {error && !error.field && <FieldError code={error.code} />}
      <Button className="h-11 self-start md:h-9" disabled={pending} onClick={save}>
        {t("common.save")}
      </Button>
    </Card>
  );
}
