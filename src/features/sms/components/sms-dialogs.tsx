"use client";

import { MessageSquare, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bulkSmsPreview, sendBulkSms, sendClientSms } from "../manual-actions";
import { countSegments } from "../segments";

// Promotions get an unsubscribe line in the business's language
// ("\nგამოწერის გაუქმება: https://…/u/…", about 70 characters); in Georgian or
// Russian it also makes the whole SMS Unicode. Count with a stand-in of that size.
const OPT_OUT_LEN = 70;
const withOptOut = (text: string, locale: string) => text + (locale === "en" ? "x" : "ა").repeat(OPT_OUT_LEN);

function Counter({ text, optOut = false }: { text: string; optOut?: boolean }) {
  const t = useTranslations("smsSettings");
  const locale = useLocale();
  const seg = countSegments(optOut ? withOptOut(text, locale) : text);
  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {t("counter", { chars: seg.length, segments: seg.segments })}
    </p>
  );
}

export function ClientSmsDialog({ clientId, phone }: { clientId: string; phone: string | null }) {
  const t = useTranslations("smsManual");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 self-start md:h-9" disabled={!phone}>
          <MessageSquare aria-hidden />
          {t("sendToClient")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sendToClient")}</DialogTitle>
          <DialogDescription>{phone}</DialogDescription>
        </DialogHeader>
        <FormField id="sms-one" label={t("text")}>
          <Textarea
            id="sms-one"
            rows={4}
            maxLength={600}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </FormField>
        <Counter text={text} optOut={marketing} />
        <div className="flex items-start gap-3">
          <Checkbox
            id="sms-one-mkt"
            checked={marketing}
            onCheckedChange={(v) => setMarketing(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="sms-one-mkt" className="leading-snug font-normal">
            {t("isPromotion")}
            <span className="block text-xs text-muted-foreground">{t("isPromotionHint")}</span>
          </Label>
        </div>
        <FieldError code={error} />
        <DialogFooter>
          <Button
            className="h-11 md:h-9"
            disabled={pending || !text.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const r = await sendClientSms({ clientId, text, marketing });
                if (!r.ok) return setError(r.error);
                toast.success(t("sent"));
                setText("");
                setOpen(false);
              })
            }
          >
            <Send aria-hidden />
            {t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkSmsDialog({ tags }: { tags: string[] }) {
  const t = useTranslations("smsManual");
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ key: string; count: number; balance: number } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let live = true;
    bulkSmsPreview({ tag }).then((r) => live && r.ok && setPreview({ key: tag, ...r.data }));
    return () => {
      live = false;
    };
  }, [open, tag]);
  const count = preview?.key === tag ? preview.count : null;
  const locale = useLocale();
  const perMessage = countSegments(withOptOut(text, locale)).segments;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <MessageSquare aria-hidden />
          {t("bulk")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("bulk")}</DialogTitle>
          <DialogDescription>{t("bulkHint")}</DialogDescription>
        </DialogHeader>
        <FormField id="sms-bulk-tag" label={t("tag")} hint={t("tagHint")}>
          <Input
            id="sms-bulk-tag"
            list="sms-bulk-tags"
            className="h-11 md:h-9"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <datalist id="sms-bulk-tags">
            {tags.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </FormField>
        <p className="text-sm font-medium" aria-live="polite">
          {count === null ? "…" : t("recipients", { count })}
        </p>
        <FormField id="sms-bulk" label={t("text")}>
          <Textarea
            id="sms-bulk"
            rows={4}
            maxLength={600}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </FormField>
        <Counter text={text} optOut />
        {count !== null && count > 0 && text.trim() && (
          <p className="text-sm">
            {t("cost", { total: count * perMessage, balance: preview?.balance ?? 0 })}
          </p>
        )}
        <FieldError code={error} />
        <DialogFooter>
          <Button
            className="h-11 md:h-9"
            disabled={pending || !text.trim() || !count}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const r = await sendBulkSms({ text, tag });
                if (!r.ok) return setError(r.error);
                toast.success(t("queued", { count: r.data.queued }));
                setText("");
                setOpen(false);
              })
            }
          >
            <Send aria-hidden />
            {t("sendBulk", { count: count ?? 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
