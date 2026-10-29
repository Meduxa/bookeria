import { describe, expect, it } from "vitest";
import { discountedMonthly, PERIODS } from "./pricing";

describe("discountedMonthly", () => {
  it("rounds down to whole lari", () => {
    expect(discountedMonthly(3900, 0)).toBe(3900);
    expect(discountedMonthly(3900, 10)).toBe(3500); // 35.10
    expect(discountedMonthly(3900, 20)).toBe(3100); // 31.20
    expect(discountedMonthly(3900, 30)).toBe(2700); // 27.30
    expect(discountedMonthly(8900, 10)).toBe(8000); // 80.10
    expect(discountedMonthly(8900, 20)).toBe(7100); // 71.20
    expect(discountedMonthly(8900, 30)).toBe(6200); // 62.30
  });

  it("never rounds up; without a discount the price stays exact", () => {
    expect(discountedMonthly(4999, 0)).toBe(4999);
    expect(discountedMonthly(4999, 10)).toBe(4400); // 44.99
    expect(discountedMonthly(5000, 10)).toBe(4500);
  });

  it("offers 1, 6, 12 and 18 months", () => {
    expect(PERIODS.map((p) => p.months)).toEqual([1, 6, 12, 18]);
  });
});
