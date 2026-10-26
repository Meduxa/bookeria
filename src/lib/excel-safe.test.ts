import { describe, expect, it } from "vitest";
import { excelSafe } from "./excel-safe";

describe("excelSafe", () => {
  it("neutralises text Excel would run as a formula", () => {
    expect(excelSafe('=HYPERLINK("http://x","click")')).toBe('\'=HYPERLINK("http://x","click")');
    expect(excelSafe("+995599")).toBe("'+995599");
    expect(excelSafe("-1")).toBe("'-1");
    expect(excelSafe("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("leaves normal text alone", () => {
    expect(excelSafe("ნინო ბერიძე")).toBe("ნინო ბერიძე");
    expect(excelSafe("a=b")).toBe("a=b");
  });
});
