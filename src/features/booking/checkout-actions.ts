"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { memberContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { parseMoneyToMinor } from "@/lib/money";
import { PAYMENT_METHODS } from "./payment-methods";

const uuid = z.uuid();

// Extra items and payments of one booking. Payments come back empty when the
// person may not see money (RLS: owner / admins unless hidden / own bookings).
export async function bookingMoney(bookingId: string) {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(bookingId).success) return null;
  const [charges, payments] = await Promise.all([
    ctx.supabase
      .from("booking_charges")
      .select("id, name, price_minor")
      .eq("booking_id", bookingId)
      .order("created_at"),
    ctx.supabase
      .from("payments")
      .select("id, method, amount_minor, tip_minor, status, created_at")
      .eq("booking_id", bookingId)
      .order("created_at"),
  ]);
  return { charges: charges.data ?? [], payments: payments.data ?? [] };
}

const moneyText = z
  .string()
  .trim()
  .refine((s) => parseMoneyToMinor(s) !== null, "priceInvalid")
  .transform((s) => parseMoneyToMinor(s)!);

const checkoutSchema = z.object({
  bookingId: z.uuid(),
  charges: z.array(z.object({ name: z.string().trim().min(1).max(200), price: moneyText })).max(20),
  discount: z.object({ kind: z.enum(["amount", "percent"]), value: z.string().trim() }),
  payments: z
    .array(z.object({ method: z.enum(PAYMENT_METHODS), amount: moneyText }))
    .min(1)
    .max(4),
  tip: z.string().trim(),
  tipStaffId: z.uuid().nullable(),
  itemsMinor: z.number().int().min(0), // shown total of the booking lines, for the % discount
});

export async function checkout(input: z.input<typeof checkoutSchema>): Promise<ActionResult> {
  const ctx = await memberContext();
  const parsed = checkoutSchema.safeParse(input);
  if (!ctx || !parsed.success) return fail("invalidInput");
  const v = parsed.data;

  const chargesMinor = v.charges.reduce((s, c) => s + c.price, 0);
  let discountMinor = 0;
  if (v.discount.value) {
    if (v.discount.kind === "percent") {
      const pct = Number(v.discount.value.replace(",", "."));
      if (!(pct >= 0 && pct <= 100)) return fail("invalidInput");
      discountMinor = Math.round(((v.itemsMinor + chargesMinor) * pct) / 100);
    } else {
      const d = parseMoneyToMinor(v.discount.value);
      if (d === null) return fail("priceInvalid");
      discountMinor = d;
    }
  }
  const tipMinor = v.tip ? parseMoneyToMinor(v.tip) : 0;
  if (tipMinor === null) return fail("priceInvalid");

  const { error } = await ctx.supabase.rpc("checkout_booking", {
    p_booking: v.bookingId,
    p_charges: v.charges.map((c) => ({ name: c.name, price_minor: c.price })),
    p_discount_minor: discountMinor,
    p_payments: v.payments
      .filter((p) => p.amount > 0)
      .map((p) => ({ method: p.method, amount_minor: p.amount })),
    p_tip_minor: tipMinor,
    p_tip_staff: v.tipStaffId as string,
  });
  if (error) {
    if (error.code === "42501") return fail("notAllowed");
    if (error.code === "22023") return fail("discountTooBig");
    if (error.code === "P0001") return fail("cannotPay");
    return fail("generic");
  }
  revalidatePath(`/${ctx.locale}/calendar`);
  revalidatePath(`/${ctx.locale}/cash`);
  return ok(undefined);
}
