"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { FormField, SwitchRow } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WeekEditor, type Week } from "@/components/week-editor";
import type { ActionResult } from "@/lib/action-result";
import {
  addClosure,
  addResource,
  deleteSettingsItem,
  saveBusiness,
  saveOpeningHours,
  saveRules,
} from "../actions";
import { slotSteps, type RulesInput } from "../schema";

export type SettingsData = {
  isOwner: boolean;
  isDental: boolean;
  business: { name: string; address: string; phone: string; email: string };
  rules: RulesInput;
  hours: Week;
  closures: { id: string; date: string; reason: string | null }[];
  resources: { id: string; name: string; type: "chair" | "room" | "equipment" }[];
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="gap-4 p-4 md:p-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function useSave() {
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast.success(t("saved"));
      after?.();
    });
  return { pending, error, run };
}

export function SettingsView({ data }: { data: SettingsData }) {
  const t = useTranslations();
  const format = useFormatter();
  const [biz, setBiz] = useState(data.business);
  const [rules, setRules] = useState(data.rules);
  const [closure, setClosure] = useState({ date: "", reason: "" });
  const [resource, setResource] = useState({
    name: "",
    type: "chair" as const as "chair" | "room" | "equipment",
  });
  const bizSave = useSave();
  const rulesSave = useSave();
  const listSave = useSave();

  const numberField = (key: "minNoticeHours" | "maxDaysAhead" | "cancelWindowHours", max: number) => (
    <FormField id={key} label={t(`settings.rules.${key}`)} hint={t(`settings.rules.${key}Hint`)}>
      <Input
        id={key}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={String(rules[key])}
        onChange={(e) => setRules({ ...rules, [key]: e.target.value })}
        className="h-11 w-32 md:h-9"
      />
    </FormField>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />

      <Section title={t("settings.business.title")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="biz-name"
            label={t("onboarding.name")}
            hint={data.isOwner ? undefined : t("settings.business.ownerOnly")}
          >
            <Input
              id="biz-name"
              value={biz.name}
              disabled={!data.isOwner}
              onChange={(e) => setBiz({ ...biz, name: e.target.value })}
              className="h-11 md:h-9"
            />
          </FormField>
          <FormField id="biz-phone" label={t("staff.fields.phone")}>
            <Input
              id="biz-phone"
              type="tel"
              inputMode="tel"
              value={biz.phone}
              onChange={(e) => setBiz({ ...biz, phone: e.target.value })}
              className="h-11 md:h-9"
            />
          </FormField>
          <FormField id="biz-email" label={t("auth.email")}>
            <Input
              id="biz-email"
              type="email"
              value={biz.email}
              onChange={(e) => setBiz({ ...biz, email: e.target.value })}
              className="h-11 md:h-9"
            />
          </FormField>
          <FormField id="biz-address" label={t("settings.business.address")}>
            <Input
              id="biz-address"
              value={biz.address}
              onChange={(e) => setBiz({ ...biz, address: e.target.value })}
              className="h-11 md:h-9"
            />
          </FormField>
        </div>
        <FieldError code={bizSave.error} />
        <Button
          className="h-11 self-start md:h-9"
          disabled={bizSave.pending}
          onClick={() => bizSave.run(() => saveBusiness(biz))}
        >
          {t("common.save")}
        </Button>
      </Section>

      <Section title={t("settings.hours.title")}>
        <WeekEditor initial={data.hours} hint={t("settings.hours.hint")} onSave={saveOpeningHours} />
      </Section>

      <Section title={t("settings.closures.title")} hint={t("settings.closures.hint")}>
        <div className="flex flex-wrap items-end gap-2">
          <FormField id="closure-date" label={t("staff.overrides.date")}>
            <Input
              id="closure-date"
              type="date"
              value={closure.date}
              onChange={(e) => setClosure({ ...closure, date: e.target.value })}
              className="h-11 w-44 md:h-9"
            />
          </FormField>
          <FormField
            id="closure-reason"
            label={`${t("settings.closures.reason")} (${t("common.optional")})`}
            className="min-w-48 flex-1"
          >
            <Input
              id="closure-reason"
              value={closure.reason}
              onChange={(e) => setClosure({ ...closure, reason: e.target.value })}
              className="h-11 md:h-9"
            />
          </FormField>
          <Button
            className="h-11 md:h-9"
            disabled={listSave.pending || !closure.date}
            onClick={() =>
              listSave.run(
                () => addClosure(closure),
                () => setClosure({ date: "", reason: "" }),
              )
            }
          >
            <Plus aria-hidden />
            {t("common.add")}
          </Button>
        </div>
        {data.closures.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.closures.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {data.closures.map((c) => (
              <li key={c.id} className="flex min-h-11 items-center gap-3 px-3 py-1">
                <span className="flex-1 text-sm">
                  {format.dateTime(new Date(`${c.date}T12:00:00`), { dateStyle: "full" })}
                  {c.reason && <span className="text-muted-foreground"> · {c.reason}</span>}
                </span>
                <ConfirmDialog
                  description={t("common.confirm")}
                  onConfirm={() => listSave.run(() => deleteSettingsItem("closure", c.id))}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={t("common.delete")}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <FieldError code={listSave.error} />
      </Section>

      <Section title={t("settings.rules.title")} hint={t("settings.rules.hint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {numberField("minNoticeHours", 168)}
          {numberField("maxDaysAhead", 365)}
          {numberField("cancelWindowHours", 168)}
          <FormField
            id="slotStepMin"
            label={t("settings.rules.slotStepMin")}
            hint={t("settings.rules.slotStepMinHint")}
          >
            <Select
              value={String(rules.slotStepMin)}
              onValueChange={(v) => setRules({ ...rules, slotStepMin: v })}
            >
              <SelectTrigger id="slotStepMin" className="h-11 w-32 md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slotSteps.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {t("format.minutes", { m: s })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        {(["onlineRequiresApproval", "staffSeesAllClients", "staffSeesAllBookings"] as const).map((k) => (
          <SwitchRow key={k} label={t(`settings.rules.${k}`)} hint={t(`settings.rules.${k}Hint`)}>
            <Switch checked={rules[k]} onCheckedChange={(v) => setRules({ ...rules, [k]: v })} />
          </SwitchRow>
        ))}
        <FieldError code={rulesSave.error} />
        <Button
          className="h-11 self-start md:h-9"
          disabled={rulesSave.pending}
          onClick={() => rulesSave.run(() => saveRules(rules))}
        >
          {t("common.save")}
        </Button>
      </Section>

      {data.isDental && (
        <Section title={t("settings.resources.title")} hint={t("settings.resources.hint")}>
          <div className="flex flex-wrap items-end gap-2">
            <FormField id="res-name" label={t("staff.fields.displayName")} className="min-w-48 flex-1">
              <Input
                id="res-name"
                value={resource.name}
                onChange={(e) => setResource({ ...resource, name: e.target.value })}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField id="res-type" label={t("settings.resources.type")}>
              <Select
                value={resource.type}
                onValueChange={(v) => setResource({ ...resource, type: v as "chair" })}
              >
                <SelectTrigger id="res-type" className="h-11 w-40 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["chair", "room", "equipment"] as const).map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`settings.resources.types.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <Button
              className="h-11 md:h-9"
              disabled={listSave.pending || !resource.name.trim()}
              onClick={() =>
                listSave.run(
                  () => addResource(resource),
                  () => setResource({ ...resource, name: "" }),
                )
              }
            >
              <Plus aria-hidden />
              {t("common.add")}
            </Button>
          </div>
          {data.resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("settings.resources.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {data.resources.map((r) => (
                <li key={r.id} className="flex min-h-11 items-center gap-3 px-3 py-1">
                  <span className="flex-1 text-sm">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`settings.resources.types.${r.type}`)}
                  </span>
                  <ConfirmDialog
                    description={t("common.confirm")}
                    onConfirm={() => listSave.run(() => deleteSettingsItem("resource", r.id))}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={t("common.delete")}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
