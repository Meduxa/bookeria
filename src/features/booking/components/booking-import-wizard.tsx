"use client";

import { FileUp, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { fileToTable, textToTable } from "@/lib/spreadsheet";
import { importBookings } from "../import-actions";
import {
  FIELDS,
  guessMapping,
  parseBookingTable,
  type CatalogLite,
  type Field,
  type Mapping,
} from "../import/parse";

const NONE = "__none";

export function BookingImportWizard({ catalog }: { catalog: CatalogLite }) {
  const t = useTranslations();
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("pasted");
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [result, setResult] = useState<{
    imported: number;
    skipped: { line: number; reason: string }[];
  } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const load = (tbl: string[][], name: string) => {
    setTable(tbl);
    setFileName(name);
    setMapping(guessMapping(tbl[0] ?? []));
  };
  const rows = useMemo(
    () => (table ? parseBookingTable(table, mapping, catalog) : []),
    [table, mapping, catalog],
  );
  const ready = rows.filter((r) => r.issues.length === 0);

  if (result) {
    return (
      <Card className="gap-3 p-4">
        <h2 className="text-base font-semibold">{t("bookingImport.done", { imported: result.imported })}</h2>
        {result.skipped.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {result.skipped.map((s) => (
              <li key={s.line}>
                {t("bookingImport.line", { line: s.line })}:{" "}
                {t(`bookingImport.skip.${s.reason as "overlap"}`)}
              </li>
            ))}
          </ul>
        )}
        <Button className="h-11 self-start md:h-9" onClick={() => router.push("/calendar?view=list")}>
          {t("calendar.title")}
        </Button>
      </Card>
    );
  }

  if (!table) {
    return (
      <Card className="gap-5 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="paste">{t("bookingImport.paste")}</Label>
          <Textarea
            id="paste"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-sm"
            aria-describedby="bi-hint"
          />
          <p id="bi-hint" className="text-xs text-muted-foreground">
            {t("bookingImport.hint")}
          </p>
        </div>
        <Button
          className="h-11 self-start md:h-9"
          disabled={!text.trim()}
          onClick={() => load(textToTable(text), "pasted")}
        >
          {t("bookingImport.read")}
        </Button>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50">
          <FileUp className="size-4" aria-hidden />
          {t("import.upload")}
          <input
            type="file"
            accept=".xlsx,.csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) load(await fileToTable(f).catch(() => [] as string[][]), f.name);
            }}
          />
        </label>
      </Card>
    );
  }

  const header = table[0] ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3 p-4">
        <h2 className="text-base font-semibold">{t("bookingImport.columns")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f: Field) => (
            <div key={f} className="flex flex-col gap-1">
              <Label htmlFor={`map-${f}`}>{t(`bookingImport.fields.${f}`)}</Label>
              <Select
                value={mapping[f] === undefined ? NONE : String(mapping[f])}
                onValueChange={(v) => setMapping({ ...mapping, [f]: v === NONE ? undefined : Number(v) })}
              >
                <SelectTrigger id={`map-${f}`} className="h-11 w-full md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {header.map((h, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {h || `#${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("bookingImport.noSms")}
        </p>
      </Card>

      <p className="text-sm text-muted-foreground">
        {t("bookingImport.summary", { ok: ready.length, problems: rows.length - ready.length })}
      </p>
      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y text-sm">
          {rows.slice(0, 300).map((r) => (
            <li key={r.line} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
              <span className="w-28 tabular-nums">
                {r.date ?? "—"} {r.time ?? ""}
              </span>
              <span className="min-w-0 flex-1">
                {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"} · {r.serviceName || "—"} ·{" "}
                {r.staffName || "—"}
              </span>
              <span className="tabular-nums">{formatMoney(r.priceMinor)}</span>
              {r.issues.map((i) => (
                <StatusPill key={i} tone="danger">
                  {t(`bookingImport.issues.${i}`)}
                </StatusPill>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <FieldError code={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11 md:h-9"
          disabled={pending || ready.length === 0}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const r = await importBookings(ready, fileName);
              if (!r.ok) return setError(r.error);
              toast.success(t("bookingImport.done", { imported: r.data.imported }));
              setResult(r.data);
            })
          }
        >
          {t("bookingImport.importButton", { count: ready.length })}
        </Button>
        <Button variant="outline" className="h-11 md:h-9" onClick={() => setTable(null)}>
          {t("import.startOver")}
        </Button>
      </div>
    </div>
  );
}
