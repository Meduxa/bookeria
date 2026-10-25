import { describe, expect, it } from "vitest";
import { parseDuration, parsePrice, parsePriceTable } from "./parse";

describe("parsePrice", () => {
  it.each([
    ["35", { type: "fixed", minor: 3500, maxMinor: null }],
    ["25-დან", { type: "from", minor: 2500, maxMinor: null }],
    ["80-დან", { type: "from", minor: 8000, maxMinor: null }],
    ["250–300", { type: "range", minor: 25000, maxMinor: 30000 }],
    ["150–200-დან", { type: "range", minor: 15000, maxMinor: 20000 }],
    ["45 ₾", { type: "fixed", minor: 4500, maxMinor: null }],
    ["45,50 ლარი", { type: "fixed", minor: 4550, maxMinor: null }],
    ["from 30", { type: "from", minor: 3000, maxMinor: null }],
    ["от 40", { type: "from", minor: 4000, maxMinor: null }],
    ["30+", { type: "from", minor: 3000, maxMinor: null }],
    ["100 - 120", { type: "range", minor: 10000, maxMinor: 12000 }],
  ])("%s", (input, expected) => {
    expect(parsePrice(input)).toEqual(expected);
  });

  it.each(["", "free", "300–250", "35 ₾ / 45 ₾", "-"])("rejects %j", (input) => {
    expect(parsePrice(input)).toBeNull();
  });
});

describe("parseDuration", () => {
  it.each([
    ["45", 45],
    ["45 წთ", 45],
    ["45 წუთი", 45],
    ["1 სთ", 60],
    ["1.5 სთ", 90],
    ["1:30", 90],
    ["1 სთ 30 წთ", 90],
    ["90 min", 90],
    ["2ч", 120],
    ["90 мин", 90],
  ])("%s → %d", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it("returns null for text", () => {
    expect(parseDuration("soon")).toBeNull();
  });
});

describe("parsePriceTable — real salon price list (reference 11), pasted from the web", () => {
  const pasted = [
    ["სერვისები და ფასები"],
    ["სალონური მომსახურებები"],
    ["ქალის თმის შეჭრა", "35"],
    ["დავარცხნა", "25-დან"],
    ["აფრიკული ნაწნავები", "250–300"],
    ["მელირება", "150–200-დან"],
    ["მანიკური / პედიკური"],
    ["კლასიკური მანიკური", "20"],
    ["შილაქი გამაგრებით", "45"],
  ];
  const rows = parsePriceTable(pasted);

  it("treats lone text rows as categories and keeps the latest one", () => {
    expect(rows.map((r) => [r.category, r.name])).toEqual([
      ["სალონური მომსახურებები", "ქალის თმის შეჭრა"],
      ["სალონური მომსახურებები", "დავარცხნა"],
      ["სალონური მომსახურებები", "აფრიკული ნაწნავები"],
      ["სალონური მომსახურებები", "მელირება"],
      ["მანიკური / პედიკური", "კლასიკური მანიკური"],
      ["მანიკური / პედიკური", "შილაქი გამაგრებით"],
    ]);
  });

  it("reads every price format and has no errors", () => {
    expect(rows.every((r) => r.issues.length === 0)).toBe(true);
    expect(rows[1].price).toEqual({ type: "from", minor: 2500, maxMinor: null });
    expect(rows[3].price).toEqual({ type: "range", minor: 15000, maxMinor: 20000 });
  });

  it("marks durations as missing (the user picks them in the preview)", () => {
    expect(rows.every((r) => r.durationMin === null)).toBe(true);
  });
});

describe("parsePriceTable — spreadsheet with headers", () => {
  it("maps columns by header names in any language and reads durations", () => {
    const rows = parsePriceTable([
      ["კატეგორია", "მომსახურება", "ფასი", "ხანგრძლივობა"],
      ["თმა", "ქალის შეჭრა", "55", "45 წთ"],
      ["თმა", "შეღებვა პროდუქტით X", "80", "2 სთ"],
      ["ფრჩხილები", "მანიკური გელით", "45", "1:15"],
    ]);
    expect(rows).toEqual([
      {
        line: 2,
        category: "თმა",
        name: "ქალის შეჭრა",
        price: { type: "fixed", minor: 5500, maxMinor: null },
        durationMin: 45,
        issues: [],
      },
      {
        line: 3,
        category: "თმა",
        name: "შეღებვა პროდუქტით X",
        price: { type: "fixed", minor: 8000, maxMinor: null },
        durationMin: 120,
        issues: [],
      },
      {
        line: 4,
        category: "ფრჩხილები",
        name: "მანიკური გელით",
        price: { type: "fixed", minor: 4500, maxMinor: null },
        durationMin: 75,
        issues: [],
      },
    ]);
  });

  it("reports problems per row instead of failing the whole file", () => {
    const rows = parsePriceTable([
      ["Service", "Price", "Duration"],
      ["Haircut", "free", "45"],
      ["Colour", "", "60"],
      ["", "30", "30"],
      ["Mask", "15", "forever"],
    ]);
    expect(rows.map((r) => r.issues)).toEqual([["badPrice"], ["noPrice"], ["noName"], ["badDuration"]]);
  });
});
