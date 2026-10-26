"use client";

import { ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { addBusinessPhoto, removeBusinessPhoto } from "../photo-actions";
import { MAX_PHOTOS, MAX_PHOTO_BYTES } from "../photo-limits";

// Photos clients see on the booking page (salon interior, work examples).
export function PhotosCard({
  tenantId,
  photos,
}: {
  tenantId: string;
  photos: { id: string; url: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const upload = async (files: FileList) => {
    setBusy(true);
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        if (file.size > MAX_PHOTO_BYTES) {
          toast.error(t("photos.tooBig"));
          continue;
        }
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient()
          .storage.from("business-photos")
          .upload(path, file, { contentType: file.type });
        if (error) throw error;
        const r = await addBusinessPhoto(path);
        if (!r.ok) throw new Error(r.error);
      }
      router.refresh();
    } catch {
      toast.error(t("errors.uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("photos.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("photos.hint", { max: MAX_PHOTOS })}</p>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.map((p, i) => (
          <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- our own storage */}
            <img src={p.url} alt={t("photos.alt", { n: i + 1 })} className="size-full object-cover" />
            <button
              type="button"
              disabled={pending}
              aria-label={t("photos.remove", { n: i + 1 })}
              onClick={() =>
                startTransition(async () => {
                  await removeBusinessPhoto(p.id);
                  router.refresh();
                })
              }
              className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-background/90 shadow focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50">
              <ImagePlus className="size-5" aria-hidden />
              {busy ? "…" : t("photos.add")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(e) => e.target.files?.length && upload(e.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
    </Card>
  );
}
