import { describe, expect, it } from "vitest";
import { inQuietHours, renderSms, sendTime, unknownVariables } from "./render";
import { countSegments } from "./segments";

describe("countSegments", () => {
  it("Latin GSM text: 160 per SMS, 153 per part", () => {
    expect(countSegments("Hello").segments).toBe(1);
    expect(countSegments("a".repeat(160))).toMatchObject({ encoding: "gsm", segments: 1 });
    expect(countSegments("a".repeat(161)).segments).toBe(2);
    expect(countSegments("a".repeat(306)).segments).toBe(2);
    expect(countSegments("a".repeat(307)).segments).toBe(3);
  });
  it("extended GSM characters count twice", () => {
    expect(countSegments("€".repeat(80))).toMatchObject({ encoding: "gsm", length: 160, segments: 1 });
    expect(countSegments("€".repeat(81)).segments).toBe(2);
  });
  it("Georgian and Russian text is Unicode: 70 per SMS, 67 per part", () => {
    expect(countSegments("ა".repeat(70))).toMatchObject({ encoding: "unicode", segments: 1, perSegment: 70 });
    expect(countSegments("ა".repeat(71))).toMatchObject({ segments: 2, perSegment: 67 });
    expect(countSegments("ა".repeat(134)).segments).toBe(2);
    expect(countSegments("ა".repeat(135)).segments).toBe(3);
    expect(countSegments("Привет").encoding).toBe("unicode");
  });
  it("one Georgian letter makes the whole text Unicode", () => {
    expect(countSegments("Salon Nino: 26 ოქტ 15:00").encoding).toBe("unicode");
  });
  it("an emoji takes two Unicode characters", () => {
    expect(countSegments("😀").length).toBe(2);
  });
});

describe("renderSms", () => {
  it("fills variables and keeps unknown ones visible", () => {
    expect(
      renderSms("{business_name}: {date} {time}. {manage_link}", {
        business_name: "სალონი ნინო",
        date: "26 ოქტომბერი",
        time: "15:00",
        manage_link: "https://x/m/abc",
      }),
    ).toBe("სალონი ნინო: 26 ოქტომბერი 15:00. https://x/m/abc");
    expect(renderSms("Hi {clientname}", {})).toBe("Hi {clientname}");
    expect(unknownVariables("Hi {clientname} {date}")).toEqual(["clientname"]);
  });
  it("an empty variable leaves no double spaces", () => {
    expect(renderSms("{business_name} {address} ok", { business_name: "A" })).toBe("A ok");
  });
});

describe("inQuietHours", () => {
  const m = (h: number, min = 0) => h * 60 + min;
  it("handles quiet hours across midnight", () => {
    expect(inQuietHours(m(23), m(22), m(9))).toBe(true);
    expect(inQuietHours(m(3), m(22), m(9))).toBe(true);
    expect(inQuietHours(m(9), m(22), m(9))).toBe(false);
    expect(inQuietHours(m(12), m(22), m(9))).toBe(false);
  });
  it("and within a day; equal times mean none", () => {
    expect(inQuietHours(m(14), m(13), m(15))).toBe(true);
    expect(inQuietHours(m(16), m(13), m(15))).toBe(false);
    expect(inQuietHours(m(16), m(10), m(10))).toBe(false);
  });
});

describe("sendTime (quiet hours 22:00–09:00, Tbilisi)", () => {
  const tz = "Asia/Tbilisi";
  const quiet = { start: "22:00", end: "09:00" };
  const at = (s: string) => new Date(`${s}+04:00`);
  it("outside quiet hours: now", () => {
    const now = at("2026-11-02T14:00:00");
    expect(sendTime(now, tz, quiet, at("2026-11-03T10:00:00"))).toEqual(now);
  });
  it("late evening: next morning at 09:00, if still before the visit", () => {
    expect(sendTime(at("2026-11-02T23:30:00"), tz, quiet, at("2026-11-03T11:00:00"))).toEqual(
      at("2026-11-03T09:00:00"),
    );
  });
  it("after midnight: the same morning", () => {
    expect(sendTime(at("2026-11-03T02:00:00"), tz, quiet, at("2026-11-03T11:00:00"))).toEqual(
      at("2026-11-03T09:00:00"),
    );
  });
  it("visit before quiet hours end: skip", () => {
    expect(sendTime(at("2026-11-03T06:00:00"), tz, quiet, at("2026-11-03T08:30:00"))).toBeNull();
  });
});
