import { describe, expect, it } from "vitest";
import { blocking, parseBirthday, parseClientTable } from "./parse";

describe("parseBirthday", () => {
  it.each([
    ["25.10.1990", "1990-10-25"],
    ["5/3/1985", "1985-03-05"],
    ["1990-10-25", "1990-10-25"],
  ])("%s", (input, expected) => {
    expect(parseBirthday(input)).toBe(expected);
  });

  it.each(["31.02.1990", "1990", "tomorrow", "01.01.1800", "01.01.2999"])("rejects %s", (input) => {
    expect(parseBirthday(input)).toBeNull();
  });
});

describe("parseClientTable", () => {
  it("reads a Georgian spreadsheet with consent columns", () => {
    const { rows, recognised } = parseClientTable([
      ["სახელი", "გვარი", "ტელეფონი", "ელფოსტა", "დაბადების დღე", "SMS თანხმობა", "ელფოსტის თანხმობა"],
      ["ნინო", "ბერიძე", "555 12 34 56", "Nino@Example.ge", "25.10.1990", "კი", ""],
      ["გიორგი", "", "+995 599 11 22 33", "", "", "არა", "დიახ"],
    ]);
    expect(recognised).toBe(true);
    expect(rows).toEqual([
      {
        line: 2,
        first_name: "ნინო",
        last_name: "ბერიძე",
        phone_e164: "+995555123456",
        email: "nino@example.ge",
        birthday: "1990-10-25",
        notes: null,
        consent_sms: true,
        consent_email: false,
        issues: [],
      },
      {
        line: 3,
        first_name: "გიორგი",
        last_name: null,
        phone_e164: "+995599112233",
        email: null,
        birthday: null,
        notes: null,
        consent_sms: false,
        consent_email: true,
        issues: [],
      },
    ]);
  });

  it("splits a single full-name column and reads Russian headers", () => {
    const { rows } = parseClientTable([
      ["ФИО", "Телефон"],
      ["Анна Мария Петрова", "555123456"],
    ]);
    expect(rows[0]).toMatchObject({
      first_name: "Анна",
      last_name: "Мария Петрова",
      phone_e164: "+995555123456",
    });
  });

  it("flags bad and duplicate rows; nothing is guessed silently", () => {
    const { rows } = parseClientTable([
      ["Name", "Phone", "Email", "Birthday"],
      ["Ana", "12", "", ""],
      ["", "555111222", "", ""],
      ["Eka", "555111222", "not-an-email", "31.02.1990"],
    ]);
    expect(rows.map((r) => r.issues)).toEqual([
      ["badPhone"],
      ["noName"],
      ["duplicateInFile", "badEmail", "badBirthday"],
    ]);
    expect(rows.map(blocking)).toEqual([true, true, true]);
  });

  it("says when it cannot recognise the columns", () => {
    expect(
      parseClientTable([
        ["a", "b"],
        ["1", "2"],
      ]).recognised,
    ).toBe(false);
  });
});
