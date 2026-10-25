"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";

export type PriceShape = {
  priceType: "fixed" | "from" | "range";
  priceMinor: number;
  priceMaxMinor: number | null;
};

// Price and duration as people read them: "55 ₾", "25 ₾-დან", "250–300 ₾", "1 სთ 30 წთ".
export function useFormat() {
  const t = useTranslations("format");

  const price = ({ priceType, priceMinor, priceMaxMinor }: PriceShape) => {
    if (priceType === "range" && priceMaxMinor !== null) {
      return t("priceRange", {
        min: formatMoney(priceMinor).replace(/\s?₾/, ""),
        max: formatMoney(priceMaxMinor),
      });
    }
    const p = formatMoney(priceMinor);
    return priceType === "from" ? t("priceFrom", { price: p }) : p;
  };

  const duration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return t("minutes", { m });
    if (m === 0) return t("hours", { h });
    return t("hoursMinutes", { h, m });
  };

  return { price, duration };
}
