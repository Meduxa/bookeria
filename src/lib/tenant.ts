import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_TENANT_COOKIE = "bk_tenant";

export type Role = "owner" | "admin" | "staff";

export type TenantMembership = {
  tenantId: string;
  name: string;
  type: "salon" | "dental";
  slug: string;
  role: Role;
};

// The user's active memberships, read through RLS (a user only ever sees their own).
export const getMyTenants = cache(async (): Promise<TenantMembership[]> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("memberships")
    .select("tenant_id, role, tenants!inner(name, type, slug)")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .order("created_at");
  if (error) throw new Error("Could not load businesses");

  return (data ?? []).map((m) => {
    const t = m.tenants as unknown as { name: string; type: "salon" | "dental"; slug: string };
    return { tenantId: m.tenant_id, role: m.role, name: t.name, type: t.type, slug: t.slug };
  });
});

// The cookie only says which business the user last chose. It is re-checked
// against the user's memberships on every request, so a forged value is ignored.
export const getActiveTenant = cache(async (): Promise<TenantMembership | null> => {
  const tenants = await getMyTenants();
  if (tenants.length === 0) return null;
  const wanted = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  return tenants.find((t) => t.tenantId === wanted) ?? tenants[0];
});

// Call only with a tenant id that came from the database, never from the browser.
export async function rememberActiveTenant(tenantId: string) {
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function canManage(role: Role) {
  return role === "owner" || role === "admin";
}
