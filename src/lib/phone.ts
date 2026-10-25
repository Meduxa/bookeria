import { parsePhoneNumberFromString } from "libphonenumber-js/max";

// Accepts "5XX XX XX XX", "995…", "+995…" (and other countries with +).
// Returns E.164 or null when the number is not valid.
export function normalizePhone(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, "");
  if (!raw) return null;
  const candidate = raw.startsWith("+") ? raw : raw.startsWith("995") ? `+${raw}` : raw;
  const parsed = parsePhoneNumberFromString(candidate, "GE");
  return parsed?.isValid() ? parsed.number : null;
}
