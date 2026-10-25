// Calendar dates are plain local dates ("yyyy-MM-dd") of the business; the
// arithmetic happens at UTC noon so no time zone can shift the day.
// Names come from our own messages (dates.months, weekdays.long), because some
// browsers ship without Georgian date data.

export type DateParts = { year: number; month: number; day: number; weekday: number }; // weekday 1 = Monday

const noon = (date: string) => new Date(`${date}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function dateParts(date: string): DateParts {
  const d = noon(date);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: ((d.getUTCDay() + 6) % 7) + 1,
  };
}

export const addDays = (date: string, n: number) => {
  const d = noon(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

export const startOfWeek = (date: string) => addDays(date, 1 - dateParts(date).weekday);

export const weekDates = (date: string) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i));

export const startOfMonth = (date: string) => date.slice(0, 8) + "01";

export function addMonths(date: string, n: number) {
  const { year, month } = dateParts(date);
  const d = new Date(Date.UTC(year, month - 1 + n, 1, 12));
  return iso(d);
}

// Monday-first grid of whole weeks covering the month (5 or 6 rows).
export function monthGrid(date: string): string[] {
  const first = startOfMonth(date);
  const last = addDays(addMonths(first, 1), -1);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
