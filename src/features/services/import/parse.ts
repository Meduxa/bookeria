// Turns a price list (pasted from a web page / Excel, or read from a CSV/XLSX
// file) into service rows. Pure functions: no DB, fully unit-tested against
// real Georgian price lists (design/references/10-*, 11-*).

export type PriceType = "fixed" | "from" | "range";

export type ParsedPrice = { type: PriceType; minor: number; maxMinor: number | null };

export type ImportIssue = "noName" | "noPrice" | "badPrice" | "badDuration" | "nameTooLong";

export type ParsedServiceRow = {
  line: number; // 1-based row in the source, for the error report
  category: string | null;
  name: string;
  price: ParsedPrice | null;
  durationMin: number | null; // null = not in the source; the user picks one
  issues: ImportIssue[];
};

const FROM_MARKERS = /(-?\s*დან|^\s*დან\s*|^\s*from\s+|^\s*от\s+|\+\s*$)/i;
const CURRENCY = /(₾|ლარი|ლ\.|gel|лари|лар\.?)/gi;
const NUMBER = String.raw`\d+(?:[.,]\d{1,2})?`;

function toMinor(n: string): number {
  const [whole, frac = ""] = n.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

// "35", "25-დან", "250–300", "150–200-დან", "45 ₾", "from 30", "от 40", "30+"
export function parsePrice(input: string): ParsedPrice | null {
  let s = input.replace(CURRENCY, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const isFrom = FROM_MARKERS.test(s);
  s = s.replace(FROM_MARKERS, "").trim();

  const range = s.match(new RegExp(`^(${NUMBER})\\s*[-–—]\\s*(${NUMBER})$`));
  if (range) {
    const [min, max] = [toMinor(range[1]), toMinor(range[2])];
    if (max > min) return { type: "range", minor: min, maxMinor: max };
    if (max === min) return { type: isFrom ? "from" : "fixed", minor: min, maxMinor: null };
    return null;
  }
  const single = s.match(new RegExp(`^(${NUMBER})$`));
  if (single) return { type: isFrom ? "from" : "fixed", minor: toMinor(single[1]), maxMinor: null };
  return null;
}

// "45", "45 წთ", "45 min", "1 სთ", "1.5 სთ", "1:30", "1 სთ 30 წთ", "90 мин", "2ч"
export function parseDuration(input: string): number | null {
  const s = input.toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return null;
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  const hours = s.match(/(\d+(?:[.,]\d+)?)\s*(სთ|საათ\S*|h|hr|hrs|hours?|ч|час\S*)/);
  const mins = s.match(/(\d+)\s*(წთ|წუთ\S*|m|min|mins|minutes?|мин\S*)/);
  if (hours || mins) {
    const total = (hours ? Number(hours[1].replace(",", ".")) * 60 : 0) + (mins ? Number(mins[1]) : 0);
    return Math.round(total);
  }
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

const HEADER_WORDS = {
  name: /^(name|service|სახელ|მომსახურ|სერვის|процедур|услуг|название|наименование)/i,
  price: /^(price|ფას|цена|стоимость|ღირებულ)/i,
  duration: /^(duration|time|ხანგრძლ|დრო|длительн|время)/i,
  category: /^(category|კატეგორ|группа|категор)/i,
};

type Columns = { name: number; price: number; duration: number | null; category: number | null };

function detectHeader(row: string[]): Columns | null {
  const find = (re: RegExp) => row.findIndex((c) => re.test(c.trim()));
  const name = find(HEADER_WORDS.name);
  const price = find(HEADER_WORDS.price);
  if (name < 0 || price < 0) return null;
  const duration = find(HEADER_WORDS.duration);
  const category = find(HEADER_WORDS.category);
  return { name, price, duration: duration < 0 ? null : duration, category: category < 0 ? null : category };
}

const MAX_NAME = 300;

export function parsePriceTable(table: string[][]): ParsedServiceRow[] {
  const cleaned = table.map((r) => r.map((c) => (c ?? "").toString().replace(/ /g, " ").trim()));
  const header = cleaned.length ? detectHeader(cleaned[0]) : null;
  const start = header ? 1 : 0;
  const out: ParsedServiceRow[] = [];
  let category: string | null = null;

  for (let i = start; i < cleaned.length; i++) {
    const row = cleaned[i];
    const filled = row.filter(Boolean);
    if (filled.length === 0) continue;

    // A lone text cell without a price is a category heading.
    if (filled.length === 1 && !parsePrice(filled[0]) && (!header || header.category === null)) {
      category = filled[0];
      continue;
    }

    let name: string;
    let priceCell: string | undefined;
    let durationCell: string | undefined;
    let rowCategory = category;

    if (header) {
      name = row[header.name] ?? "";
      priceCell = row[header.price];
      durationCell = header.duration !== null ? row[header.duration] : undefined;
      if (header.category !== null && row[header.category]) rowCategory = row[header.category];
    } else {
      // No header: first non-price text is the name, the first price-like cell
      // is the price, a cell with time units (or a later plain number) is the duration.
      const cells = row.map((c, idx) => ({ c, idx })).filter(({ c }) => c);
      const priceIdx = cells.findIndex(({ c }, k) => k > 0 && parsePrice(c));
      name = cells[0]?.c ?? "";
      priceCell = priceIdx >= 0 ? cells[priceIdx].c : undefined;
      const rest = cells.filter((_, k) => k > 0 && k !== priceIdx);
      durationCell = rest.find(({ c }) => parseDuration(c) !== null)?.c;
    }

    const issues: ImportIssue[] = [];
    if (!name) issues.push("noName");
    if (name.length > MAX_NAME) issues.push("nameTooLong");
    const price = priceCell ? parsePrice(priceCell) : null;
    if (!priceCell) issues.push("noPrice");
    else if (!price) issues.push("badPrice");
    let durationMin: number | null = null;
    if (durationCell) {
      durationMin = parseDuration(durationCell);
      if (durationMin === null || durationMin < 5 || durationMin > 720) {
        issues.push("badDuration");
        durationMin = null;
      }
    }

    out.push({
      line: i + 1,
      category: rowCategory,
      name: name.slice(0, MAX_NAME),
      price,
      durationMin,
      issues,
    });
  }
  return out;
}
