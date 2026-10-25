"use client";

import { CalendarPlus, Trash2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useDates } from "@/lib/use-dates";
import { cn } from "@/lib/utils";
import { setWaitlistStatus, type WaitlistEntry } from "../waitlist-actions";

export function WaitlistPanel({
  open,
  onOpenChange,
  entries,
  highlight,
  onBook,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: WaitlistEntry[];
  highlight: string[];
  onBook: (entry: WaitlistEntry) => void;
}) {
  const t = useTranslations();
  const dates = useDates();
  const [pending, startTransition] = useTransition();
  const sorted = [...entries].sort(
    (a, b) => Number(highlight.includes(b.id)) - Number(highlight.includes(a.id)),
  );

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("waitlist.title")}
      description={t("waitlist.hint")}
    >
      {sorted.length === 0 ? (
        <EmptyState title={t("waitlist.empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((w) => (
            <li
              key={w.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3",
                highlight.includes(w.id) && "border-primary bg-accent/50",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 font-medium">
                  {w.client.name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{w.client.phone}</span>
                </span>
                {w.client.importantNote && (
                  <TriangleAlert
                    className="size-4 text-warning"
                    aria-label={t("clients.fields.importantNote")}
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {w.serviceName} · {w.staffName ?? t("booking.anyStaff")}
              </p>
              <p className="text-sm">
                {dates.dayShort(w.dateFrom)} – {dates.dayShort(w.dateTo)}
                {w.timeFrom && w.timeTo ? ` · ${w.timeFrom}–${w.timeTo}` : ` · ${t("waitlist.anyTime")}`}
              </p>
              {w.note && <p className="text-xs text-muted-foreground">{w.note}</p>}
              <div className="flex flex-wrap gap-2">
                <Button className="h-11 md:h-9" onClick={() => onBook(w)}>
                  <CalendarPlus aria-hidden />
                  {t("waitlist.book")}
                </Button>
                <ConfirmDialog
                  description={t("common.confirm")}
                  confirmLabel={t("waitlist.remove")}
                  onConfirm={() =>
                    startTransition(async () => {
                      const r = await setWaitlistStatus(w.id, "cancelled");
                      if (!r.ok) toast.error(t(`errors.${r.error}`));
                    })
                  }
                  trigger={
                    <Button variant="ghost" className="h-11 md:h-9" disabled={pending}>
                      <Trash2 aria-hidden />
                      {t("waitlist.remove")}
                    </Button>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DetailPanel>
  );
}
