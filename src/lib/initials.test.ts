import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("keeps Georgian letters as they are (no Mtavruli)", () => {
    expect(initials("ნინო ბერიძე", "")).toBe("ნბ");
  });

  it("uppercases Latin and Cyrillic", () => {
    expect(initials("levan medoshvili", "")).toBe("LM");
    expect(initials("юлия петрова", "")).toBe("ЮП");
  });

  it("falls back to the email", () => {
    expect(initials("", "nino@example.ge")).toBe("N");
  });
});
