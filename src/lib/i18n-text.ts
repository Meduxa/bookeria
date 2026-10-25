import type { Json } from "@/lib/supabase/database.types";

export type I18nText = Partial<Record<"ka" | "en" | "ru", string>>;

const FALLBACK = ["ka", "en", "ru"] as const;

// A name stored as {ka, en, ru}: show the requested language, else the first
// one that is filled in (Georgian first).
export function localized(value: Json | I18nText | null | undefined, locale: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const v = value as Record<string, unknown>;
  const pick = (k: string) => (typeof v[k] === "string" && (v[k] as string).trim() ? (v[k] as string) : "");
  return pick(locale) || FALLBACK.map(pick).find(Boolean) || "";
}

export function asI18n(value: Json | null | undefined): I18nText {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  const out: I18nText = {};
  for (const k of FALLBACK) if (typeof v[k] === "string") out[k] = v[k] as string;
  return out;
}

// Drops empty languages so the DB stores only what was filled in.
export function compactI18n(value: I18nText): I18nText {
  const out: I18nText = {};
  for (const k of FALLBACK) {
    const s = value[k]?.trim();
    if (s) out[k] = s;
  }
  return out;
}
