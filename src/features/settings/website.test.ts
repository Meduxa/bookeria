import { describe, expect, it } from "vitest";
import { socialHandle } from "./website";

describe("socialHandle", () => {
  it("keeps only the handle from a link or @name", () => {
    expect(socialHandle("https://www.instagram.com/salon.nino/?hl=ka", "instagram")).toBe("salon.nino");
    expect(socialHandle("@salon_nino", "instagram")).toBe("salon_nino");
    expect(socialHandle("instagram.com/salon", "instagram")).toBe("salon");
    expect(socialHandle("https://m.facebook.com/Salon-Nino", "facebook")).toBe("Salon-Nino");
    expect(socialHandle("fb.com/salonnino", "facebook")).toBe("salonnino");
  });
  it("empty is none; anything else is refused", () => {
    expect(socialHandle("  ", "instagram")).toBeNull();
    expect(socialHandle("https://evil.example/x", "instagram")).toBeUndefined();
    expect(socialHandle("javascript:alert(1)", "facebook")).toBeUndefined();
    expect(socialHandle("a".repeat(31), "instagram")).toBeUndefined();
  });
});
