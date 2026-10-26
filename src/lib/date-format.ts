// Dates as text with our own month names (messages `dates.*`). Never Intl date
// styles: Node on the server lacks Georgian data ("2026 M10 26") while browsers
// have it, which breaks hydration. Works with useTranslations and getTranslations.
import { dateParts } from "./dates";
import { DEFAULT_TZ } from "./time";

// Any next-intl translator; keys are checked by the messages parity test.
type Translator = (key: never, values?: never) => string;
type Values = Record<string, string | number>;
const tr = (t: Translator, key: string, values?: Values) =>
  (t as unknown as (k: string, v?: Values) => string)(key, values);

/** "2026-10-26" (or an ISO instant) in the given time zone */
export const ymdIn = (iso: string, timeZone = DEFAULT_TZ) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone });

/** "26 ოქტომბერი 2026" / "26 October 2026" / "26 октября 2026" for a "YYYY-MM-DD" date */
export function fullDate(t: Translator, date: string) {
  const p = dateParts(date.slice(0, 10));
  return tr(t, "dates.full", { day: p.day, month: tr(t, `dates.months.${p.month}`), year: p.year });
}

/** "26 ოქტომბერი 2026, 14:30" for an instant, shown in the business time zone */
export function fullDateTime(t: Translator, iso: string, timeZone = DEFAULT_TZ) {
  const time = new Date(iso).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  return tr(t, "dates.at", { date: fullDate(t, ymdIn(iso, timeZone)), time });
}

/** "26 ოქტომბერი" — day and month only, for SMS where every character counts */
export function shortDate(t: Translator, date: string) {
  const p = dateParts(date.slice(0, 10));
  return tr(t, "dates.dayShort", { day: p.day, month: tr(t, `dates.months.${p.month}`) });
}
