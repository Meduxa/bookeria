// Money is integer tetri (1 GEL = 100 tetri). Never floats in storage.

export function formatMoney(minor: number, locale = "ka-GE", currency = "GEL"): string {
  if (!Number.isInteger(minor)) throw new Error("Money must be an integer number of minor units");
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
}

// "55", "55.5", "55,50" → 5550. Returns null for anything else.
export function parseMoneyToMinor(input: string): number | null {
  const m = input
    .trim()
    .replace(/\s/g, "")
    .match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
