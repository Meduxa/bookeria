"use client";

import { useTranslations } from "next-intl";
import { dateParts } from "./dates";

// "25 ოქტომბერი, კვირა" / "Sunday, 25 October" / "воскресенье, 25 октября"
export function useDates() {
  const t = useTranslations();
  const parts = (date: string) => {
    const p = dateParts(date);
    return {
      day: p.day,
      month: t(`dates.months.${p.month}` as "dates.months.1"),
      weekday: t(`weekdays.long.${p.weekday}` as "weekdays.long.1"),
      weekdayShort: t(`weekdays.short.${p.weekday}` as "weekdays.short.1"),
      year: p.year,
      monthTitle: t(`dates.monthTitle.${p.month}` as "dates.monthTitle.1"),
    };
  };
  return {
    parts,
    dayTitle: (date: string) => {
      const p = parts(date);
      return t("dates.day", { day: p.day, month: p.month, weekday: p.weekday });
    },
    dayShort: (date: string) => {
      const p = parts(date);
      return t("dates.dayShort", { day: p.day, month: p.month });
    },
    monthYear: (date: string) => {
      const p = parts(date);
      return t("dates.monthYear", { month: p.monthTitle, year: p.year });
    },
  };
}
