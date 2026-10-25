// Georgian has no case in everyday writing: toUpperCase() would turn "ნ" into
// the Mtavruli capital "Ნ", so only Latin/Cyrillic initials are uppercased.
const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/;

export function initials(name: string, email: string) {
  const parts = (name || email).trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => {
      const ch = [...p][0] ?? "";
      return GEORGIAN.test(ch) ? ch : ch.toUpperCase();
    })
    .join("");
}
