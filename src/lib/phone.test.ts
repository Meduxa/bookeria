import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["555 12 34 56", "+995555123456"],
    ["555123456", "+995555123456"],
    ["995555123456", "+995555123456"],
    ["+995 555 12-34-56", "+995555123456"],
    ["(555) 12 34 56", "+995555123456"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("keeps foreign numbers given with +", () => {
    expect(normalizePhone("+49 30 901820")).toBe("+4930901820");
  });

  it.each(["", "12", "abc", "+995 12"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
