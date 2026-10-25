// Existing bookings from another system or a paper diary typed into Excel.
// Pure: column guessing, row parsing and matching to our services and staff.
import { parseMoneyToMinor } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";

export const FIELDS = [
  "date",
  "time",
  "datetime",
  "client",
  "phone",
  "service",
  "staff",
  "price",
  "duration",
  "status",
] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Partial<Record<Field, number>>; // field → column index

const GUESS: Record<Field, RegExp> = {
  datetime: /^(date ?time|თარიღი და დრო|дата и время|start)/i,
  date: /^(date|day|თარიღი|დღე|дата|день)/i,
  time: /^(time|hour|დრო|საათი|время)/i,
  client: /^(client|patient|name|customer|კლიენტი|პაციენტი|სახელი|клиент|пациент|имя|фио)/i,
  phone: /^(phone|mobile|tel|ტელ|ტელეფონი|მობილური|телефон)/i,
  service: /^(service|procedure|სერვისი|მომსახურება|პროცედურა|услуга|процедура)/i,
  staff:
    /^(staff|master|doctor|employee|სპეციალისტი|ოსტატი|ექიმი|თანამშრომელი|мастер|врач|сотрудник|специалист)/i,
  price: /^(price|amount|sum|ფასი|თანხა|ჯამი|цена|сумма)/i,
  duration: /^(duration|length|minutes|ხანგრძლივობა|წუთი|длительность|минут)/i,
  status: /^(status|სტატუსი|статус)/i,
};

export function guessMapping(header: string[]): Mapping {
  const m: Mapping = {};
  header.forEach((h, i) => {
    const c = h.trim();
    for (const f of ["datetime", ...FIELDS.filter((x) => x !== "datetime")] as Field[]) {
      if (m[f] === undefined && GUESS[f].test(c)) {
        m[f] = i;
        break;
      }
    }
  });
  return m;
}

// "14:30", "14.30", "9:05", "1430"
export function parseTime(s: string): string | null {
  const v = s.trim().match(/^(\d{1,2})[:.]?(\d{2})(?::\d{2})?$/);
  if (!v) return null;
  const [h, m] = [Number(v[1]), Number(v[2])];
  return h < 24 && m < 60 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null;
}

// Dates in the past or future are fine here (unlike birthdays).
export function parseDate(s: string): string | null {
  const v = s.trim();
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const eu = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const [y, mo, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : eu
      ? [Number(eu[3]), Number(eu[2]), Number(eu[1])]
      : [0, 0, 0];
  if (!y) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d ||
    y < 2000 ||
    y > 2100
  )
    return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const STATUS: [RegExp, string][] = [
  [/^(cancel|გაუქმ|отмен)/i, "cancelled_by_client"],
  [/^(no.?show|არ გამოცხ|არ მოვიდა|не приш|неявк)/i, "no_show"],
  [/^(done|completed|finished|დასრულ|შესრულ|выполн|заверш)/i, "completed"],
  [/^(confirmed|booked|დადასტ|подтвер)/i, "confirmed"],
];

export type CatalogLite = {
  services: { id: string; names: string[]; durationMin: number; priceMinor: number }[];
  staff: { id: string; name: string }[];
};

export type BookingIssue =
  "noDate" | "badDate" | "badTime" | "unknownService" | "unknownStaff" | "badPhone" | "badPrice";

export type ParsedBookingRow = {
  line: number;
  date: string | null;
  time: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  serviceId: string | null;
  serviceName: string;
  staffId: string | null;
  staffName: string;
  durationMin: number;
  priceMinor: number;
  status: string | null;
  issues: BookingIssue[];
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function matchService(name: string, catalog: CatalogLite) {
  const n = norm(name);
  if (!n) return null;
  return (
    catalog.services.find((s) => s.names.some((x) => norm(x) === n)) ??
    catalog.services.find((s) => s.names.some((x) => norm(x).includes(n) || n.includes(norm(x)))) ??
    null
  );
}

function matchStaff(name: string, catalog: CatalogLite) {
  const n = norm(name);
  if (!n) return null;
  return (
    catalog.staff.find((s) => norm(s.name) === n) ??
    catalog.staff.find((s) => norm(s.name).split(" ")[0] === n.split(" ")[0]) ??
    null
  );
}

export function parseBookingTable(
  table: string[][],
  mapping: Mapping,
  catalog: CatalogLite,
): ParsedBookingRow[] {
  const rows: ParsedBookingRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i].map((c) => (c ?? "").toString().replace(/ /g, " ").trim());
    if (!r.some(Boolean)) continue;
    const get = (f: Field) => (mapping[f] !== undefined ? (r[mapping[f]!] ?? "") : "");
    const issues: BookingIssue[] = [];

    let date: string | null = null;
    let time: string | null = null;
    if (mapping.datetime !== undefined) {
      const [d, t] = get("datetime").split(/\s+/);
      date = parseDate(d ?? "");
      time = parseTime(t ?? "");
    } else {
      date = parseDate(get("date"));
      time = parseTime(get("time"));
    }
    const rawDate = mapping.datetime !== undefined ? get("datetime") : get("date");
    if (!rawDate) issues.push("noDate");
    else if (!date) issues.push("badDate");
    if (!time) issues.push("badTime");

    const [firstName = "", ...rest] = get("client").split(/\s+/).filter(Boolean);
    const rawPhone = get("phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) issues.push("badPhone");

    const service = matchService(get("service"), catalog);
    if (!service) issues.push("unknownService");
    const staff = matchStaff(get("staff"), catalog) ?? (catalog.staff.length === 1 ? catalog.staff[0] : null);
    if (!staff) issues.push("unknownStaff");

    const rawPrice = get("price").replace(/[₾\s]|ლარი|gel/gi, "");
    const price = rawPrice ? parseMoneyToMinor(rawPrice) : (service?.priceMinor ?? 0);
    if (price === null) issues.push("badPrice");
    const duration = Number(get("duration")) || service?.durationMin || 60;
    const status = STATUS.find(([re]) => re.test(get("status")))?.[1] ?? null;

    rows.push({
      line: i + 1,
      date,
      time,
      firstName,
      lastName: rest.join(" "),
      phone,
      serviceId: service?.id ?? null,
      serviceName: get("service"),
      staffId: staff?.id ?? null,
      staffName: staff?.name ?? get("staff"),
      durationMin: Math.min(720, Math.max(5, duration)),
      priceMinor: price ?? 0,
      status,
      issues,
    });
  }
  return rows;
}
