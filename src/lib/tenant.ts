import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_TENANT_COOKIE = "bk_tenant";

export type Role = "owner" | "admin" | "staff";
export type BusinessType = "salon" | "dental";

// The DB enforces these values with check constraints; this narrows the text
// columns for TypeScript and fails loudly if the two ever drift apart.
function oneOf<T extends string>(allowed: readonly T[], value: string, what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Unexpected ${what}: ${value}`);
}
export const asRole = (v: string) => oneOf<Role>(["owner", "admin", "staff"], v, "role");
export const asInviteRole = (v: string) => oneOf<"admin" | "staff">(["admin", "staff"], v, "invite role");
export const asBusinessType = (v: string) => oneOf<BusinessType>(["salon", "dental"], v, "business type");

export type TenantMembership = {
  tenantId: string;
  name: string;
  type: "salon" | "dental";
  slug: string;
  role: Role;
  plan: string;
  status: TenantStatus;
  trialEndsAt: string;
  deletionDueAt: string | null;
};

export type TenantStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
const asStatus = (v: string) =>
  oneOf<TenantStatus>(["trial", "active", "past_due", "suspended", "cancelled"], v, "tenant status");

/** Suspended or cancelled businesses can look and export, but not change anything. */
export const isReadOnly = (t: Pick<TenantMembership, "status">) =>
  t.status === "suspended" || t.status === "cancelled";

// The user's active memberships, read through RLS (a user only ever sees their own).
export const getMyTenants = cache(async (): Promise<TenantMembership[]> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("memberships")
    .select("tenant_id, role, tenants!inner(name, type, slug, plan, status, trial_ends_at, deletion_due_at)")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .order("created_at");
  if (error) throw new Error("Could not load businesses");

  return (data ?? []).map((m) => ({
    tenantId: m.tenant_id,
    role: asRole(m.role),
    name: m.tenants.name,
    type: asBusinessType(m.tenants.type),
    slug: m.tenants.slug,
    plan: m.tenants.plan,
    status: asStatus(m.tenants.status),
    trialEndsAt: m.tenants.trial_ends_at,
    deletionDueAt: m.tenants.deletion_due_at,
  }));
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
