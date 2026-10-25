// Client list (pasted or from CSV/XLSX) → rows ready for import_clients.
// Pure and unit-tested. Duplicate phones inside the file are flagged here;
// phones that already exist in the business are flagged by the server.
import { normalizePhone } from "@/lib/phone";

export type ClientIssue = "noName" | "badPhone" | "badEmail" | "badBirthday" | "duplicateInFile";

export type ParsedClientRow = {
  line: number;
  first_name: string;
  last_name: string | null;
  phone_e164: string | null;
  email: string | null;
  birthday: string | null; // yyyy-mm-dd
  notes: string | null;
  consent_sms: boolean;
  consent_email: boolean;
  issues: ClientIssue[];
};

const H = {
  fullName: /^(name|full ?name|client|სახელი(,| და)? ?გვარი|კლიენტი|пациент|клиент|фио|имя и фамилия)$/i,
  first: /^(first ?name|სახელი|имя)$/i,
  last: /^(last ?name|surname|გვარი|фамилия)$/i,
  phone: /^(phone|mobile|tel|ტელ|ტელეფონი|მობილური|ნომერი|телефон|моб)/i,
  email: /^(e-?mail|ელ\.? ?ფოსტა|ელფოსტა|почта|эл\.? ?почта)/i,
  birthday: /^(birthday|birth ?date|dob|დაბადების|დაბ\.|день рождения|дата рождения)/i,
  notes: /^(notes?|comment|შენიშვნა|კომენტარი|заметк|коммент|примеч)/i,
  sms: /(sms|სმს).*(consent|თანხმობა|согласие|marketing|მარკეტინგ|реклам)|^(consent ?sms|marketing sms)$/i,
  email_consent:
    /(e-?mail|ელფოსტ|почт).*(consent|თანხმობა|согласие|marketing|მარკეტინგ|реклам)|^(consent ?e-?mail|marketing e-?mail)$/i,
};

type Cols = Partial<Record<keyof typeof H, number>>;

function detect(header: string[]): Cols | null {
  const cols: Cols = {};
  header.forEach((raw, i) => {
    const c = raw.trim();
    // consent columns first: "SMS consent" must not be read as a phone column
    if (H.sms.test(c)) cols.sms ??= i;
    else if (H.email_consent.test(c)) cols.email_consent ??= i;
    else if (H.fullName.test(c)) cols.fullName ??= i;
    else if (H.first.test(c)) cols.first ??= i;
    else if (H.last.test(c)) cols.last ??= i;
    else if (H.phone.test(c)) cols.phone ??= i;
    else if (H.email.test(c)) cols.email ??= i;
    else if (H.birthday.test(c)) cols.birthday ??= i;
    else if (H.notes.test(c)) cols.notes ??= i;
  });
  const hasName = cols.fullName !== undefined || cols.first !== undefined;
  return hasName && (cols.phone !== undefined || cols.email !== undefined) ? cols : null;
}

const YES = /^(yes|y|true|1|კი|დიახ|да|✓|✔|x|\+)$/i;

// "25.10.1990", "25/10/1990", "1990-10-25" → "1990-10-25"
export function parseBirthday(s: string): string | null {
  const v = s.trim();
  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const eu = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (eu) [d, m, y] = [Number(eu[1]), Number(eu[2]), Number(eu[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || date > new Date()) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseClientTable(table: string[][]): { rows: ParsedClientRow[]; recognised: boolean } {
  const cleaned = table.map((r) => r.map((c) => (c ?? "").toString().replace(/ /g, " ").trim()));
  const cols = cleaned.length ? detect(cleaned[0]) : null;
  if (!cols) return { rows: [], recognised: false };

  const seen = new Set<string>();
  const rows: ParsedClientRow[] = [];
  for (let i = 1; i < cleaned.length; i++) {
    const r = cleaned[i];
    if (!r.some(Boolean)) continue;
    const get = (k: keyof Cols) => (cols[k] !== undefined ? (r[cols[k]!] ?? "") : "");

    let first = get("first");
    let last: string = get("last");
    if (cols.fullName !== undefined) {
      const parts = get("fullName").split(/\s+/).filter(Boolean);
      first = parts[0] ?? "";
      last = parts.slice(1).join(" ");
    }

    const issues: ClientIssue[] = [];
    if (!first) issues.push("noName");

    const rawPhone = get("phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) issues.push("badPhone");
    if (phone) {
      if (seen.has(phone)) issues.push("duplicateInFile");
      seen.add(phone);
    }

    const rawEmail = get("email").toLowerCase();
    const emailOk = !rawEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
    if (!emailOk) issues.push("badEmail");

    const rawBirthday = get("birthday");
    const birthday = rawBirthday ? parseBirthday(rawBirthday) : null;
    if (rawBirthday && !birthday) issues.push("badBirthday");

    rows.push({
      line: i + 1,
      first_name: first.slice(0, 80),
      last_name: last ? last.slice(0, 80) : null,
      phone_e164: phone,
      email: rawEmail && emailOk ? rawEmail : null,
      birthday,
      notes: get("notes") ? get("notes").slice(0, 4000) : null,
      consent_sms: YES.test(get("sms")),
      consent_email: YES.test(get("email_consent")),
      issues,
    });
  }
  return { rows, recognised: true };
}

// Rows that must not be imported as they are.
export const blocking = (r: ParsedClientRow) =>
  r.issues.some((i) => i === "noName" || i === "badPhone" || i === "duplicateInFile");
