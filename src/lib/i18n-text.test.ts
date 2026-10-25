import { describe, expect, it } from "vitest";
import { compactI18n, localized } from "./i18n-text";

describe("localized", () => {
  it("uses the requested language, then falls back Georgian-first", () => {
    const name = { ka: "შეჭრა", en: "Haircut" };
    expect(localized(name, "en")).toBe("Haircut");
    expect(localized(name, "ru")).toBe("შეჭრა");
    expect(localized({ en: "Haircut", ru: "Стрижка" }, "ka")).toBe("Haircut");
    expect(localized({ ka: "  ", ru: "Стрижка" }, "ka")).toBe("Стрижка");
  });

  it("is safe with odd values", () => {
    expect(localized(null, "ka")).toBe("");
    expect(localized(["x"], "ka")).toBe("");
  });
});

describe("compactI18n", () => {
  it("drops empty languages and trims", () => {
    expect(compactI18n({ ka: " შეჭრა ", en: "", ru: "  " })).toEqual({ ka: "შეჭრა" });
  });
});
