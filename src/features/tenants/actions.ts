"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyTenants, rememberActiveTenant } from "@/lib/tenant";
import { createBusinessSchema, type CreateBusinessInput } from "./schema";

export async function createBusiness(input: CreateBusinessInput): Promise<ActionResult> {
  await requireUser(await getLocale());
  const parsed = createBusinessSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const supabase = await createClient();
  const locale = await getLocale();
  const { data: tenantId, error } = await supabase.rpc("create_tenant", {
    p_name: parsed.data.name,
    p_type: parsed.data.type,
    p_slug: parsed.data.slug,
    p_locale: locale,
  });
  if (error) {
    if (error.code === "23505") return fail("slugTaken", "slug");
    if (error.code === "42501") return fail("notSignedIn");
    if (error.message.includes("too many businesses")) return fail("tooManyBusinesses");
    console.error("create_tenant failed", error.code);
    return fail("generic");
  }

  await rememberActiveTenant(tenantId);
  redirect(`/${locale}/dashboard`);
}

export async function switchTenant(tenantId: string) {
  await requireUser(await getLocale());
  const id = z.uuid().safeParse(tenantId);
  // Only accept a business the user is actually a member of.
  if (id.success && (await getMyTenants()).some((t) => t.tenantId === id.data)) {
    await rememberActiveTenant(id.data);
  }
  redirect(`/${await getLocale()}/dashboard`);
}
