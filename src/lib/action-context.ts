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

export type MemberContext = ManagerContext & { staffId: string | null; isManager: boolean };

// Any member of the active business (staff included). The staff member's own
// profile id comes from the database, never from the browser.
export async function memberContext(): Promise<MemberContext | null> {
  const locale = await getLocale();
  await requireUser(locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const supabase = await createClient();
  const { data: staffId } = await supabase.rpc("current_staff_id", { p_tenant: tenant.tenantId });
  return { locale, tenant, supabase, staffId: staffId ?? null, isManager: canManage(tenant.role) };
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
