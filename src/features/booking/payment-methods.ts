// Payment methods at the till (online payments come with the gateway, Phase 8).
export const PAYMENT_METHODS = ["cash", "card", "transfer", "gift_card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
