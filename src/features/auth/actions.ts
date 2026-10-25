"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { fail, type ActionResult } from "@/lib/action-result";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNext, signInSchema, signUpSchema, type SignInInput, type SignUpInput } from "./schema";

export async function signIn(input: SignInInput, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(error.code === "email_not_confirmed" ? "emailNotConfirmed" : "invalidCredentials");

  const locale = await getLocale();
  redirect(safeNext(next, `/${locale}/dashboard`));
}

export async function signUp(
  input: SignUpInput,
  next?: string,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const locale = await getLocale();
  const target = safeNext(next, `/${locale}/onboarding`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}${target}`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("emailTaken", "email");
    if (error.code === "weak_password") return fail("passwordWeak", "password");
    console.error("signUp failed", error.code);
    return fail("generic");
  }
  // Supabase hides "already registered" behind an empty identities list.
  if (data.user && data.user.identities?.length === 0) return fail("emailTaken", "email");

  if (!data.session) return { ok: true, data: { needsConfirmation: true } };
  redirect(target);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}
