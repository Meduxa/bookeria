import { describe, expect, it } from "vitest";
import { addDays, addMonths, dateParts, monthGrid, startOfWeek, weekDates } from "./dates";

describe("calendar dates", () => {
  it("knows the weekday (Monday = 1)", () => {
    expect(dateParts("2026-10-25")).toEqual({ year: 2026, month: 10, day: 25, weekday: 7 });
    expect(dateParts("2026-10-26").weekday).toBe(1);
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("weeks start on Monday", () => {
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(weekDates("2026-10-28")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("adds months from the first day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("month grid covers whole weeks", () => {
    const g = monthGrid("2026-10-15");
    expect(g[0]).toBe("2026-09-28");
    expect(g.at(-1)).toBe("2026-11-01");
    expect(g.length % 7).toBe(0);
  });
});
