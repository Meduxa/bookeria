import { Clock, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { initials } from "@/lib/initials";
import type { PublicBusinessView } from "../queries";

// Name, call / directions, opening hours and the team — above the booking flow.
export async function BusinessHeader({ business }: { business: PublicBusinessView }) {
  const t = await getTranslations();
  const map = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
    : null;

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{business.name}</h1>
        {business.address && <p className="text-sm text-muted-foreground">{business.address}</p>}
      </div>
      {business.photos.length > 0 && (
        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" aria-label={t("photos.title")}>
          {business.photos.map((src, i) => (
            <li key={src} className="shrink-0 snap-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own storage */}
              <img
                src={src}
                alt={t("photos.alt", { n: i + 1 })}
                loading={i > 1 ? "lazy" : undefined}
                className="h-32 w-44 rounded-lg object-cover sm:h-40 sm:w-56"
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {business.phone && (
          <Button variant="outline" asChild className="h-11 md:h-9">
            <a href={`tel:${business.phone}`}>
              <Phone aria-hidden />
              {t("publicBooking.call")}
            </a>
          </Button>
        )}
        {map && (
          <Button variant="outline" asChild className="h-11 md:h-9">
            <a href={map} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden />
              {t("publicBooking.directions")}
            </a>
          </Button>
        )}
      </div>

      <details className="group rounded-lg border px-3 py-2">
        <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
          <Clock className="size-4" aria-hidden />
          {t("publicBooking.hoursTitle")}
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 pb-1 text-sm">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <div key={d} className="contents">
              <dt className="text-muted-foreground">{t(`weekdays.long.${d}` as "weekdays.long.1")}</dt>
              <dd className="tabular-nums">
                {business.hours[d]?.length
                  ? business.hours[d].map(([s, e]) => `${s}–${e}`).join(", ")
                  : t("publicBooking.closed")}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {business.staff.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("publicBooking.teamTitle")}</h2>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {business.staff.map((s) => (
              <li key={s.id} className="flex w-24 shrink-0 flex-col items-center gap-1 text-center">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatars from storage
                  <img src={s.photoUrl} alt="" className="size-14 rounded-full object-cover" />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {initials(s.name, "")}
                  </span>
                )}
                <span className="text-xs leading-tight font-medium">{s.name}</span>
                {s.position && (
                  <span className="text-xs leading-tight text-muted-foreground">{s.position}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
