// The report's filters as they appear in the address (?from=&to=&staff=).
// Default: this month up to today. Ranges longer than a year are cut.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/;

export function reportParams(sp: Record<string, string | string[] | undefined>, today: string) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  let from = DATE.test(one("from")) ? one("from") : `${today.slice(0, 8)}01`;
  let to = DATE.test(one("to")) ? one("to") : today;
  if (from > to) [from, to] = [to, from];
  const maxFrom = new Date(Date.parse(`${to}T12:00:00Z`) - 366 * 86_400_000).toISOString().slice(0, 10);
  if (from < maxFrom) from = maxFrom;
  const staff = UUID.test(one("staff")) ? one("staff") : null;
  return { from, to, staff };
}
