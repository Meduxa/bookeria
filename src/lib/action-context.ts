import "server-only";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant, type TenantMembership } from "@/lib/tenant";

export type ManagerContext = {
  locale: string;
  tenant: TenantMembership;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

// Every owner/admin action starts here: signed in (else → sign-in page),
// active business resolved on the server, role checked. RLS checks again.
export async function managerContext(): Promise<ManagerContext | null> {
  const locale = await getLocale();
  await requireUser(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) return null;
  return { locale, tenant, supabase: await createClient() };
}

// Postgres error codes → our error codes. Raw DB messages never leave the server.
export function dbErrorCode(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "duplicate";
  if (error.code === "23503") return "notFound";
  if (error.code === "23514" || error.code === "22P02" || error.code === "22023") return "invalidInput";
  if (error.code === "42501") return "notAllowed";
  console.error("db error", error.code);
  return "generic";
}
