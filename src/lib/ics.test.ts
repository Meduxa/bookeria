import { describe, expect, it } from "vitest";
import { makeIcs } from "./ics";

describe("makeIcs", () => {
  it("writes UTC times and escapes text", () => {
    const ics = makeIcs({
      uid: "abc",
      start: "2026-11-02T10:00:00+04:00",
      end: "2026-11-02T11:00:00+04:00",
      title: "სალონი ნინო: შეჭრა, ვარცხნა",
      location: "თბილისი; ვაკე",
    });
    expect(ics).toContain("DTSTART:20261102T060000Z");
    expect(ics).toContain("DTEND:20261102T070000Z");
    expect(ics).toContain("SUMMARY:სალონი ნინო: შეჭრა\\, ვარცხნა");
    expect(ics).toContain("LOCATION:თბილისი\\; ვაკე");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
