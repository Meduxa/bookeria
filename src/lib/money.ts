// Money is integer tetri (1 GEL = 100 tetri). Never floats in storage.

export function formatMoney(minor: number, locale = "ka-GE", currency = "GEL"): string {
  if (!Number.isInteger(minor)) throw new Error("Money must be an integer number of minor units");
  // Whole amounts without ",00" (price lists say 55 ₾, not 55,00 ₾).
  const digits = minor % 100 === 0 ? 0 : 2;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100);
  // The symbol is added by hand: browsers without Georgian locale data would
  // otherwise print "GEL 55" instead of "55 ₾".
  return currency === "GEL" ? `${number} ₾` : `${number} ${currency}`;
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
