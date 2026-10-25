"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addDentalNote, readDentalNotes } from "../history-actions";

// Treatment notes (health data). Shown only on request; each read is logged.
export function DentalNotes({
  clientId,
  bookingId,
  timeZone,
}: {
  clientId: string;
  bookingId: string | null;
  timeZone: string;
}) {
  const t = useTranslations("dental");
  const tc = useTranslations("common");
  const [notes, setNotes] = useState<{ id: string; author: string; body: string; at: string }[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      setError(undefined);
      const r = await readDentalNotes(clientId);
      if (!r.ok) return setError(r.error);
      setNotes(r.data);
    });

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4" aria-hidden />
        {t("title")}
      </h3>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      {notes === null ? (
        <Button variant="outline" className="h-11 self-start md:h-9" disabled={pending} onClick={load}>
          {t("show")}
        </Button>
      ) : (
        <>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md bg-muted p-2 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.author} ·{" "}
                    {new Date(n.at).toLocaleString("en-GB", {
                      timeZone,
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("add")}
          />
          <Button
            className="h-11 self-start md:h-9"
            disabled={pending || !body.trim()}
            onClick={() =>
              startTransition(async () => {
                const r = await addDentalNote(clientId, bookingId, body);
                if (!r.ok) return setError(r.error);
                setBody("");
                toast.success(tc("saved"));
                const fresh = await readDentalNotes(clientId);
                if (fresh.ok) setNotes(fresh.data);
              })
            }
          >
            {t("add")}
          </Button>
        </>
      )}
      {error === "notAllowed" ? (
        <p role="alert" className="text-sm text-destructive">
          {t("notAllowed")}
        </p>
      ) : (
        <FieldError code={error} />
      )}
    </section>
  );
}
