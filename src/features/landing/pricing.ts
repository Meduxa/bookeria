// Prepaid periods on the landing page: pay for several months, get a discount.
// The monthly price is rounded down to whole lari (49 ₾ − 10 % → 44 ₾, not 44.10 ₾).
export const PERIODS = [
  { months: 1, discount: 0 },
  { months: 6, discount: 10 },
  { months: 12, discount: 20 },
  { months: 18, discount: 30 },
] as const;

export type Period = (typeof PERIODS)[number];

/** Monthly price in tetri after the period's discount, rounded down to whole lari. */
export function discountedMonthly(priceMinor: number, discount: number): number {
  if (discount === 0) return priceMinor;
  return Math.floor((priceMinor * (100 - discount)) / 10000) * 100;
}
