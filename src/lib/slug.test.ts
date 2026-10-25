import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it("transliterates Georgian", () => {
    expect(slugify("სალონი ნინო")).toBe("saloni-nino");
    expect(slugify("შუქურა ჭაჭავა")).toBe("shukura-chachava");
  });

  it("transliterates Russian and strips accents", () => {
    expect(slugify("Салон Юлия")).toBe("salon-yuliya");
    expect(slugify("Café Élan")).toBe("cafe-elan");
  });

  it("collapses symbols and trims dashes", () => {
    expect(slugify("  Dental & Smile!! 32 ")).toBe("dental-smile-32");
  });

  it("produces slugs the database accepts", () => {
    for (const name of ["სილამაზის სახლი", "Beauty Lab Tbilisi", "Стоматология 1"]) {
      expect(slugify(name)).toMatch(SLUG_PATTERN);
    }
  });

  it("limits length to 50", () => {
    expect(slugify("a".repeat(80))).toHaveLength(50);
  });
});
