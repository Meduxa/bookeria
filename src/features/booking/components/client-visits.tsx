"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { formatMoney } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { read } from "@/lib/read";
import type { ReadResult } from "../reads";
import { STATUS_TONE } from "./booking-panel";

type Visit = ReadResult<"clientVisits">[number];

// Visit history on the client card: upcoming first, then the past.
export function ClientVisits({ clientId }: { clientId: string }) {
  const t = useTranslations();
  const dates = useDates();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    read("clientVisits", clientId, []).then((v) => live && setVisits(v));
    return () => {
      live = false;
    };
  }, [clientId]);

  if (visits === null) return <p className="text-sm text-muted-foreground">…</p>;
  const upcoming = visits.filter((v) => new Date(v.start).getTime() >= now).reverse();
  const past = visits.filter((v) => new Date(v.start).getTime() < now);

  const list = (items: Visit[]) => (
    <ul className="flex flex-col divide-y rounded-lg border text-sm">
      {items.map((v) => {
        return (
          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="w-full font-medium sm:w-auto">
              {dates.dayShort(v.date)} {v.date.slice(0, 4)} · {v.time}
            </span>
            <span className="min-w-0 flex-1 text-muted-foreground">
              {v.services.join(", ")} · {v.staff}
            </span>
            <span className="tabular-nums">{formatMoney(v.totalMinor)}</span>
            <StatusPill tone={STATUS_TONE[v.status]}>
              {t(`booking.status.${v.status as "confirmed"}`)}
            </StatusPill>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{t("booking.visits")}</h3>
      {visits.length === 0 && <p className="text-sm text-muted-foreground">{t("booking.visitsEmpty")}</p>}
      {upcoming.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t("booking.upcoming")}</p>
          {list(upcoming)}
        </>
      )}
      {past.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t("booking.past")}</p>
          {list(past)}
        </>
      )}
    </section>
  );
}
