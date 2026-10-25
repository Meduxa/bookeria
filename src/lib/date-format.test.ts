import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ka from "../../messages/ka.json";
import ru from "../../messages/ru.json";
import { fullDate, fullDateTime, ymdIn } from "./date-format";

const tKa = createTranslator({ locale: "ka", messages: ka });
const tRu = createTranslator({ locale: "ru", messages: ru });

describe("date-format (same text on server and browser)", () => {
  it("writes Georgian and Russian dates with our month names", () => {
    expect(fullDate(tKa, "2026-10-26")).toBe("26 ოქტომბერი 2026");
    expect(fullDate(tRu, "2026-10-26")).toBe("26 октября 2026");
  });
  it("shows instants in the business time zone, across midnight", () => {
    // 21:30 UTC is 01:30 next day in Tbilisi
    expect(ymdIn("2026-10-26T21:30:00Z", "Asia/Tbilisi")).toBe("2026-10-27");
    expect(fullDateTime(tKa, "2026-10-26T21:30:00Z", "Asia/Tbilisi")).toBe("27 ოქტომბერი 2026, 01:30");
  });
});
