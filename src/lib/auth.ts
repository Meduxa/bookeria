import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string; fullName: string };

// Verified against Supabase Auth on every request (getUser, not the cookie alone).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();

  return { id: data.user.id, email: data.user.email ?? "", fullName: profile?.full_name ?? "" };
});

export async function requireUser(locale: string, next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return user;
}
