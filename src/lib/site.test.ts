import { describe, expect, it } from "vitest";
import { shortUrl, slugFromHost } from "./site";

describe("short addresses", () => {
  it("finds the business from the host", () => {
    expect(slugFromHost("teka.bookeria.ge", "bookeria.ge")).toBe("teka");
    expect(slugFromHost("Salon-Nino.Bookeria.ge", "bookeria.ge")).toBe("salon-nino");
    expect(slugFromHost("demo-salon.localhost:3000", "localhost:3000")).toBe("demo-salon");
  });
  it("ignores the main site, our own names, deeper hosts and other domains", () => {
    expect(slugFromHost("bookeria.ge", "bookeria.ge")).toBeNull();
    expect(slugFromHost("www.bookeria.ge", "bookeria.ge")).toBeNull();
    expect(slugFromHost("admin.bookeria.ge", "bookeria.ge")).toBeNull();
    expect(slugFromHost("a.b.bookeria.ge", "bookeria.ge")).toBeNull();
    expect(slugFromHost("teka.evil-bookeria.ge", "bookeria.ge")).toBeNull();
    expect(slugFromHost("teka.bookeria.ge", "")).toBeNull();
    expect(slugFromHost(null, "bookeria.ge")).toBeNull();
  });
  it("builds the short address only when switched on", () => {
    expect(shortUrl("teka", "bookeria.ge", true)).toBe("https://teka.bookeria.ge");
    expect(shortUrl("teka", "localhost:3000", false)).toBe("http://teka.localhost:3000");
    expect(shortUrl("teka", "", true)).toBeNull();
  });
});
