import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToMinor } from "./money";

describe("money", () => {
  it("parses prices to tetri", () => {
    expect(parseMoneyToMinor("55")).toBe(5500);
    expect(parseMoneyToMinor("55.5")).toBe(5550);
    expect(parseMoneyToMinor("55,05")).toBe(5505);
    expect(parseMoneyToMinor("1 200")).toBe(120000);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "-5", "5.555", "abc", "5.", "1e3"]) expect(parseMoneyToMinor(bad)).toBeNull();
  });

  it("formats GEL", () => {
    const text = formatMoney(5500);
    expect(text).toContain("55");
    expect(text).toMatch(/₾|GEL/);
  });

  it("refuses fractional tetri", () => {
    expect(() => formatMoney(10.5)).toThrow();
  });
});
