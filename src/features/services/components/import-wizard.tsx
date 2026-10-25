"use client";

import { FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { importServices } from "../actions";
import { parsePriceTable, type ParsedServiceRow } from "../import/parse";

type Row = ParsedServiceRow & { include: boolean; duration: string };

const BLOCKING = ["noName", "noPrice", "badPrice", "nameTooLong"] as const;
const blocked = (r: ParsedServiceRow) => r.issues.some((i) => (BLOCKING as readonly string[]).includes(i));

// Pasted text from a web page or a spreadsheet is tab-separated; CSV files use commas or semicolons.
function textToTable(text: string): string[][] {
  const delimiter = text.includes("\t") ? "\t" : "";
  return Papa.parse<string[]>(text.trim(), { delimiter, skipEmptyLines: true }).data;
}

async function fileToTable(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    // first sheet only; loaded on demand so the page stays light
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))));
  }
  return textToTable(await file.text());
}

export function ImportWizard() {
  const t = useTranslations();
  const fmt = useFormat();
  const router = useRouter();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [defaultDuration, setDefaultDuration] = useState("60");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const load = (table: string[][]) => {
    const parsed = parsePriceTable(table);
    setRows(
      parsed.map((r) => ({
        ...r,
        include: !blocked(r),
        duration: r.durationMin ? String(r.durationMin) : "",
      })),
    );
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs!.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const validDuration = (d: string) => /^\d+$/.test(d) && Number(d) >= 5 && Number(d) <= 720;
  const ready = rows?.filter((r) => r.include && !blocked(r) && validDuration(r.duration)) ?? [];
  const errors = rows?.filter(blocked).length ?? 0;
  const needDuration = rows?.filter((r) => !blocked(r) && !validDuration(r.duration)).length ?? 0;

  const submit = () => {
    setError(undefined);
    if (ready.length === 0) return setError("nothingToImport");
    startTransition(async () => {
      const result = await importServices(
        ready.map((r) => ({
          category: r.category,
          name: r.name,
          price_type: r.price!.type,
          price_minor: r.price!.minor,
          price_max_minor: r.price!.maxMinor,
          duration_min: Number(r.duration),
        })),
      );
      if (!result.ok) return setError(result.error);
      toast.success(t("import.success", { count: result.data.count }));
      router.push("/services");
    });
  };

  if (!rows) {
    return (
      <Card className="gap-5 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="paste">{t("import.paste")}</Label>
          <Textarea
            id="paste"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("import.pastePlaceholder")}
            className="font-mono text-sm"
            aria-describedby="paste-hint"
          />
          <p id="paste-hint" className="text-xs text-muted-foreground">
            {t("import.formatsHint")}
          </p>
        </div>
        <Button
          className="h-11 self-start md:h-9"
          disabled={!text.trim()}
          onClick={() => load(textToTable(text))}
        >
          {t("import.read")}
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("import.or")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50">
          <FileUp className="size-4" aria-hidden />
          {t("import.upload")}
          <input
            type="file"
            accept=".xlsx,.csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                load(await fileToTable(file));
              } catch {
                setError("generic");
              }
            }}
          />
        </label>
        <FieldError code={error} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3 p-4">
        <h2 className="text-base font-semibold">{t("import.previewTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("import.summary", { ok: rows.length - errors - needDuration, needDuration, errors })}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="default-duration">{t("import.defaultDuration")}</Label>
            <Input
              id="default-duration"
              type="number"
              inputMode="numeric"
              min={5}
              max={720}
              step={5}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(e.target.value)}
              className="h-11 w-28 md:h-9"
            />
          </div>
          <Button
            variant="outline"
            className="h-11 md:h-9"
            disabled={!validDuration(defaultDuration)}
            onClick={() =>
              setRows((rs) =>
                rs!.map((r) => (validDuration(r.duration) ? r : { ...r, duration: defaultDuration })),
              )
            }
          >
            {t("import.applyDuration")}
          </Button>
        </div>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {rows.map((r, i) => {
            const hard = blocked(r);
            const needsDuration = !validDuration(r.duration);
            return (
              <li
                key={i}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 md:grid-cols-[auto_minmax(0,1fr)_10rem_8rem_6rem_10rem] md:items-center"
              >
                <Checkbox
                  checked={r.include && !hard}
                  disabled={hard}
                  onCheckedChange={(v) => update(i, { include: v === true })}
                  aria-label={`${t("import.colInclude")}: ${r.name || r.line}`}
                  className="mt-1 md:mt-0"
                />
                <Input
                  value={r.name}
                  onChange={(e) =>
                    update(i, {
                      name: e.target.value,
                      issues: e.target.value.trim() ? r.issues.filter((x) => x !== "noName") : r.issues,
                    })
                  }
                  aria-label={t("services.colName")}
                  className="h-10 md:h-8"
                />
                <Input
                  value={r.category ?? ""}
                  onChange={(e) => update(i, { category: e.target.value || null })}
                  aria-label={t("import.colCategory")}
                  placeholder={t("import.colCategory")}
                  className="col-start-2 h-10 md:col-start-auto md:h-8"
                />
                <span className="col-start-2 text-sm font-medium tabular-nums md:col-start-auto">
                  {r.price
                    ? fmt.price({
                        priceType: r.price.type,
                        priceMinor: r.price.minor,
                        priceMaxMinor: r.price.maxMinor,
                      })
                    : "—"}
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={720}
                  step={5}
                  value={r.duration}
                  onChange={(e) => update(i, { duration: e.target.value })}
                  aria-label={t("services.fields.duration")}
                  placeholder={t("services.fields.duration")}
                  aria-invalid={needsDuration}
                  className="col-start-2 h-10 w-28 md:col-start-auto md:h-8 md:w-full"
                />
                <span className="col-start-2 flex flex-wrap gap-1 md:col-start-auto">
                  {r.issues
                    .filter((x) => x !== "badDuration")
                    .map((x) => (
                      <StatusPill key={x} tone="danger">
                        {t(`import.issues.${x}`)}
                      </StatusPill>
                    ))}
                  {!hard && needsDuration && (
                    <StatusPill tone="warning">{t("import.issues.durationMissing")}</StatusPill>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <FieldError code={error ? (error === "nothingToImport" ? undefined : error) : undefined} />
      {error === "nothingToImport" && (
        <p role="alert" className="text-sm text-destructive">
          {t("import.nothingToImport")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 md:h-9" disabled={pending || ready.length === 0} onClick={submit}>
          {t("import.importButton", { count: ready.length })}
        </Button>
        <Button variant="outline" className="h-11 md:h-9" onClick={() => setRows(null)}>
          {t("import.startOver")}
        </Button>
      </div>
    </div>
  );
}
