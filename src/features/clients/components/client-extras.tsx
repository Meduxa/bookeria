"use client";

import { Download, GitMerge, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { fullDateTime } from "@/lib/date-format";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anonymizeClient, consentHistory, exportClient, mergeClients, searchClients } from "../actions";

type History = Awaited<ReturnType<typeof consentHistory>>;

export function ConsentHistory({ clientId }: { clientId: string }) {
  const t = useTranslations("clients.consent");
  const tAll = useTranslations();
  const [items, setItems] = useState<History | null>(null);
  useEffect(() => {
    let live = true;
    consentHistory(clientId).then((h) => live && setItems(h));
    return () => {
      live = false;
    };
  }, [clientId]);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("history")}</h3>
      {items === null ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {items.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <StatusPill tone={h.granted ? "success" : "neutral"}>
                {h.channel === "sms" ? "SMS" : "Email"} · {t(h.granted ? "granted" : "withdrawn")}
              </StatusPill>
              <span className="text-muted-foreground">
                {t(`sources.${h.source as "admin"}`)} · {fullDateTime(tAll, h.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ClientRights({
  clientId,
  name,
  isOwner,
  onAnonymized,
}: {
  clientId: string;
  name: string;
  isOwner: boolean;
  onAnonymized: () => void;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  if (!isOwner) return <p className="text-xs text-muted-foreground">{t("clients.rights.ownerOnly")}</p>;

  const download = () =>
    startTransition(async () => {
      const r = await exportClient(clientId);
      if (!r.ok) return void toast.error(t(`errors.${r.error}`));
      const url = URL.createObjectURL(new Blob([r.data.json], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `client-${clientId}.json`,
      });
      a.click();
      URL.revokeObjectURL(url);
    });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("clients.rights.title")}</h3>
      <p className="text-xs text-muted-foreground">{t("clients.rights.hint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11 md:h-9" disabled={pending} onClick={download}>
          <Download aria-hidden />
          {t("clients.rights.export")}
        </Button>
        <ConfirmDialog
          description={t("clients.rights.anonymizeConfirm", { name })}
          confirmLabel={t("clients.rights.anonymize")}
          onConfirm={() =>
            startTransition(async () => {
              const r = await anonymizeClient(clientId);
              if (!r.ok) return void toast.error(t(`errors.${r.error}`));
              toast.success(t("clients.rights.anonymized"));
              onAnonymized();
            })
          }
          trigger={
            <Button variant="destructive" className="h-11 md:h-9" disabled={pending}>
              <UserX aria-hidden />
              {t("clients.rights.anonymize")}
            </Button>
          }
        />
      </div>
    </section>
  );
}

export function MergeClient({
  clientId,
  name,
  onMerged,
}: {
  clientId: string;
  name: string;
  onMerged: () => void;
}) {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchClients>>>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(() => searchClients(q, clientId).then(setResults), 300);
    return () => clearTimeout(id);
  }, [q, clientId]);
  const shown = q.trim().length < 2 ? [] : results;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("clients.merge.title")}</h3>
      <p className="text-xs text-muted-foreground">{t("clients.merge.hint")}</p>
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("clients.merge.search")}
        aria-label={t("clients.merge.search")}
        className="h-11 md:h-9"
      />
      {shown.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {shown.map((c) => {
            const other = [c.first_name, c.last_name].filter(Boolean).join(" ");
            return (
              <li key={c.id} className="flex min-h-11 items-center gap-2 px-3 py-1 text-sm">
                <span className="flex-1">
                  {other} <span className="text-muted-foreground">{c.phone_e164}</span>
                </span>
                <ConfirmDialog
                  description={t("clients.merge.confirm", { other, name })}
                  confirmLabel={t("clients.merge.title")}
                  onConfirm={() =>
                    startTransition(async () => {
                      const r = await mergeClients(clientId, c.id);
                      if (!r.ok) return void toast.error(t(`errors.${r.error}`));
                      toast.success(t("clients.merge.done"));
                      setQ("");
                      onMerged();
                    })
                  }
                  trigger={
                    <Button variant="outline" size="sm" className="h-9" disabled={pending}>
                      <GitMerge aria-hidden />
                      {t("clients.merge.title")}
                    </Button>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
