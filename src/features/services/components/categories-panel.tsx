"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localized } from "@/lib/i18n-text";
import { deleteCategory, reorderCategories, saveCategory } from "../actions";
import type { Category } from "../queries";

export function CategoriesPanel({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else after?.();
    });

  // Move with buttons: works with keyboard and touch, unlike drag-only lists.
  const move = (index: number, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    run(() => reorderCategories(ids));
  };

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("categories.title")}
      description={t("categories.hint")}
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim())
              run(
                () => saveCategory(null, { name: { [locale]: newName } }),
                () => setNewName(""),
              );
          }}
        >
          <Input
            aria-label={t("categories.add")}
            placeholder={t("categories.add")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-11 md:h-9"
          />
          <Button type="submit" className="h-11 md:h-9" disabled={pending || !newName.trim()}>
            <Plus aria-hidden />
            {t("common.add")}
          </Button>
        </form>
        <FieldError code={error} />

        {categories.length === 0 ? (
          <EmptyState className="py-6" title={t("categories.empty")} />
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {categories.map((c, i) => {
              const name = localized(c.name, locale);
              const isEditing = editing?.id === c.id;
              return (
                <li key={c.id} className="flex min-h-12 items-center gap-1 px-2 py-1">
                  {isEditing ? (
                    <form
                      className="flex flex-1 gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(
                          () => saveCategory(c.id, { name: { ...c.name, [locale]: editing.name } }),
                          () => setEditing(null),
                        );
                      }}
                    >
                      <Input
                        autoFocus
                        aria-label={t("common.edit")}
                        value={editing.name}
                        onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                        className="h-10 md:h-8"
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.save")}
                        disabled={pending}
                      >
                        <Check aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.cancel")}
                        onClick={() => setEditing(null)}
                      >
                        <X aria-hidden />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 px-1 text-sm break-words">{name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.moveUp")}
                        disabled={pending || i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.moveDown")}
                        disabled={pending || i === categories.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.edit")}
                        onClick={() => setEditing({ id: c.id, name: localized(c.name, locale) })}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <ConfirmDialog
                        description={t("categories.deleteConfirm", { name })}
                        onConfirm={() =>
                          run(
                            () => deleteCategory(c.id),
                            () => toast.success(t("common.deleted")),
                          )
                        }
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={t("common.delete")}>
                            <Trash2 aria-hidden />
                          </Button>
                        }
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DetailPanel>
  );
}
