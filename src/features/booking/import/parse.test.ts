import { describe, expect, it } from "vitest";
import { guessMapping, parseBookingTable, parseDate, parseTime, type CatalogLite } from "./parse";

const catalog: CatalogLite = {
  services: [
    { id: "cut", names: ["ქალის თმის შეჭრა", "Women's haircut"], durationMin: 45, priceMinor: 5500 },
    { id: "mani", names: ["მანიკური გელ-ლაქით"], durationMin: 75, priceMinor: 4500 },
  ],
  staff: [
    { id: "ana", name: "ანა გელაშვილი" },
    { id: "eka", name: "ეკა მაჭავარიანი" },
  ],
};

describe("dates and times", () => {
  it.each([
    ["25.10.2026", "2026-10-25"],
    ["2026-10-25", "2026-10-25"],
    ["5/3/2027", "2027-03-05"],
  ])("date %s", (i, o) => expect(parseDate(i)).toBe(o));
  it.each([
    ["14:30", "14:30"],
    ["9.05", "09:05"],
    ["1430", "14:30"],
    ["10:00:00", "10:00"],
  ])("time %s", (i, o) => expect(parseTime(i)).toBe(o));
  it("rejects nonsense", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseTime("25:00")).toBeNull();
  });
});

describe("guessMapping", () => {
  it("recognises Georgian headers", () => {
    expect(guessMapping(["თარიღი", "დრო", "კლიენტი", "ტელეფონი", "სერვისი", "ოსტატი", "ფასი"])).toEqual({
      date: 0,
      time: 1,
      client: 2,
      phone: 3,
      service: 4,
      staff: 5,
      price: 6,
    });
  });
  it("recognises a combined date-time column", () => {
    expect(guessMapping(["Date time", "Client", "Service"])).toMatchObject({
      datetime: 0,
      client: 1,
      service: 2,
    });
  });
});

describe("parseBookingTable", () => {
  it("matches services and staff by name (also by first name) and reports problems per row", () => {
    const table = [
      ["თარიღი", "დრო", "კლიენტი", "ტელეფონი", "სერვისი", "ოსტატი", "ფასი", "სტატუსი"],
      ["27.10.2026", "10:00", "ნინო ბერიძე", "555 12 34 56", "ქალის თმის შეჭრა", "ანა", "", ""],
      ["27.10.2026", "11.30", "მარიამ", "", "მანიკური გელ-ლაქით", "ეკა მაჭავარიანი", "40", "გაუქმდა"],
      ["32.10.2026", "12:00", "გიორგი", "12", "ფრჩხილის დიზაინი", "სოფო", "", ""],
    ];
    const m = guessMapping(table[0]);
    const rows = parseBookingTable(table, m, catalog);
    expect(rows[0]).toMatchObject({
      date: "2026-10-27",
      time: "10:00",
      firstName: "ნინო",
      lastName: "ბერიძე",
      phone: "+995555123456",
      serviceId: "cut",
      staffId: "ana",
      durationMin: 45,
      priceMinor: 5500,
      issues: [],
    });
    expect(rows[1]).toMatchObject({
      time: "11:30",
      serviceId: "mani",
      staffId: "eka",
      priceMinor: 4000,
      status: "cancelled_by_client",
      issues: [],
    });
    expect(rows[2].issues).toEqual(["badDate", "badPhone", "unknownService", "unknownStaff"]);
  });

  it("with only one staff member, rows without a staff column go to them", () => {
    const rows = parseBookingTable(
      [
        ["Date", "Time", "Service"],
        ["2026-11-02", "09:00", "Women's haircut"],
      ],
      { date: 0, time: 1, service: 2 },
      { ...catalog, staff: [catalog.staff[0]] },
    );
    expect(rows[0]).toMatchObject({ staffId: "ana", issues: [] });
  });
});
