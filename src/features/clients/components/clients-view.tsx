"use client";

import { FileSpreadsheet, Plus, Search, TriangleAlert, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { ClientRow } from "../queries";
import { PAGE_SIZE } from "../schema";
import { ClientVisits } from "@/features/booking/components/client-visits";
import { DentalNotes } from "@/features/booking/components/dental-notes";
import { ClientForm } from "./client-form";
import { ClientRights, ConsentHistory, MergeClient } from "./client-extras";

const fullName = (c: ClientRow) => [c.firstName, c.lastName].filter(Boolean).join(" ");

export function ClientsView({
  clients,
  total,
  q,
  page,
  staff,
  canManage,
  isOwner,
  isDental,
  timeZone,
}: {
  clients: ClientRow[];
  total: number;
  q: string;
  page: number;
  staff: { id: string; name: string }[];
  canManage: boolean;
  isOwner: boolean;
  isDental: boolean;
  timeZone: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const [openId, setOpenId] = useState<string | "new" | null>(null);

  // Search runs on the server (large client lists), debounced while typing.
  useEffect(() => {
    if (query === q) return;
    const id = setTimeout(
      () => router.replace(query ? `${pathname}?q=${encodeURIComponent(query)}` : pathname),
      300,
    );
    return () => clearTimeout(id);
  }, [query, q, pathname, router]);

  const open = openId && openId !== "new" ? (clients.find((c) => c.id === openId) ?? null) : null;
  const pages = Math.ceil(total / PAGE_SIZE);
  const goPage = (p: number) =>
    router.replace(`${pathname}?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`);
  const title = t(isDental ? "clients.titleDental" : "clients.title");

  return (
    <>
      <PageHeader
        title={title}
        description={t("clients.subtitle")}
        actions={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 md:h-9" asChild>
                <Link href="/clients/import">
                  <FileSpreadsheet aria-hidden />
                  {t("clients.import")}
                </Link>
              </Button>
              <Button className="h-11 md:h-9" onClick={() => setOpenId("new")}>
                <Plus aria-hidden />
                {t("clients.new")}
              </Button>
            </div>
          )
        }
      />

      {total === 0 && !q ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<Users />}
            title={t("clients.emptyTitle")}
            description={t("clients.emptyBody")}
            action={
              canManage && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button className="h-11 md:h-9" onClick={() => setOpenId("new")}>
                    {t("clients.new")}
                  </Button>
                  <Button variant="outline" className="h-11 md:h-9" asChild>
                    <Link href="/clients/import">{t("clients.import")}</Link>
                  </Button>
                </div>
              )
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                aria-label={t("common.search")}
                placeholder={t("clients.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 bg-card pl-9 md:h-9"
              />
            </div>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {t("clients.total", { count: total })}
            </span>
          </div>

          {clients.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("clients.noMatch")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="hidden grid-cols-[minmax(0,1fr)_11rem_9rem_7rem] gap-4 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                <span>{t("clients.colName")}</span>
                <span>{t("clients.colPhone")}</span>
                <span>{t("clients.colConsent")}</span>
                <span>{t("clients.colAdded")}</span>
              </div>
              <ul className="divide-y">
                {clients.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_11rem_9rem_7rem]"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 text-sm font-medium break-words">
                          {fullName(c)}
                          {c.importantNote && (
                            <TriangleAlert
                              className="size-3.5 shrink-0 text-warning"
                              aria-label={t("clients.fields.importantNote")}
                            />
                          )}
                        </span>
                        {c.tags.length > 0 && (
                          <span className="text-xs text-muted-foreground">{c.tags.join(" · ")}</span>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {c.phone ?? c.email ?? "—"}
                      </span>
                      <span className="col-start-1 flex flex-wrap gap-1 md:col-start-auto">
                        {c.consentSms && <StatusPill tone="success">{t("clients.sms")}</StatusPill>}
                        {c.consentEmail && <StatusPill tone="success">{t("clients.email")}</StatusPill>}
                        {c.blockedOnline && <StatusPill tone="danger">{t("clients.blocked")}</StatusPill>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format.dateTime(new Date(c.createdAt), { dateStyle: "medium" })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pages > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label="pagination">
              <Button
                variant="outline"
                className="h-11 md:h-9"
                disabled={page === 0}
                onClick={() => goPage(page - 1)}
              >
                {t("clients.prev")}
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page + 1} / {pages}
              </span>
              <Button
                variant="outline"
                className="h-11 md:h-9"
                disabled={page + 1 >= pages}
                onClick={() => goPage(page + 1)}
              >
                {t("clients.next")}
              </Button>
            </nav>
          )}
        </div>
      )}

      <DetailPanel
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open ? fullName(open) : t("clients.new")}
      >
        {openId !== null && (
          <div className="flex flex-col gap-8">
            <ClientForm
              key={openId}
              client={open}
              staff={staff}
              readOnly={!canManage}
              onSaved={(id) => {
                setOpenId(id);
                router.refresh();
              }}
            />
            {open && <ClientVisits clientId={open.id} />}
            {open && isDental && <DentalNotes clientId={open.id} bookingId={null} timeZone={timeZone} />}
            {open && canManage && (
              <>
                <ConsentHistory
                  key={`h-${open.id}-${open.consentSms}-${open.consentEmail}`}
                  clientId={open.id}
                />
                <MergeClient clientId={open.id} name={fullName(open)} onMerged={() => router.refresh()} />
                <ClientRights
                  clientId={open.id}
                  name={fullName(open)}
                  isOwner={isOwner}
                  onAnonymized={() => {
                    setOpenId(null);
                    router.refresh();
                  }}
                />
              </>
            )}
          </div>
        )}
      </DetailPanel>
    </>
  );
}
