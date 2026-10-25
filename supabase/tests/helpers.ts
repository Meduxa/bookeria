import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = (): Db => createClient<Database>(url(), process.env.SUPABASE_SECRET_KEY!, noSession);
export const anon = (): Db =>
  createClient<Database>(url(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, noSession);

export type TestUser = { id: string; email: string; db: Db };

// Every run uses a fresh random tag, so tests never touch seed or real data.
export const runTag = `t${randomBytes(4).toString("hex")}`;
const password = `Test-${randomBytes(12).toString("hex")}`;

export async function createUser(label: string): Promise<TestUser> {
  const email = `${runTag}-${label}@example.test`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${label} ${runTag}` },
  });
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);

  const db = anon();
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn ${label}: ${signInError.message}`);
  return { id: data.user.id, email, db };
}

export type TestTenant = {
  id: string;
  slug: string;
  owner: TestUser;
  adminUser: TestUser;
  staff: TestUser;
  openInviteToken: string;
};

// Builds a tenant through the real RPCs: owner creates it, invites an admin and
// a staff member, they accept. Leaves one open invitation for later tests.
export async function createTenant(label: string, type: "salon" | "dental"): Promise<TestTenant> {
  const owner = await createUser(`${label}-owner`);
  const adminUser = await createUser(`${label}-admin`);
  const staff = await createUser(`${label}-staff`);
  const slug = `${runTag}-${label}`;

  const { data: id, error } = await owner.db.rpc("create_tenant", {
    p_name: `Test ${label} ${runTag}`,
    p_type: type,
    p_slug: slug,
  });
  if (error || !id) throw new Error(`create_tenant ${label}: ${error?.message}`);

  for (const [user, role] of [
    [adminUser, "admin"],
    [staff, "staff"],
  ] as const) {
    const { data: token, error: inviteError } = await owner.db.rpc("create_invitation", {
      p_tenant: id,
      p_email: user.email,
      p_role: role,
    });
    if (inviteError || !token) throw new Error(`invite ${role}: ${inviteError?.message}`);
    const { error: acceptError } = await user.db.rpc("accept_invitation", { p_token: token });
    if (acceptError) throw new Error(`accept ${role}: ${acceptError.message}`);
  }

  const { data: openInviteToken, error: openError } = await owner.db.rpc("create_invitation", {
    p_tenant: id,
    p_email: `${runTag}-${label}-pending@example.test`,
    p_role: "staff",
  });
  if (openError || !openInviteToken) throw new Error(`open invite: ${openError?.message}`);

  return { id, slug, owner, adminUser, staff, openInviteToken };
}

// Removes this run's data, plus anything an earlier crashed run left behind.
// Throws on any failure so a cleanup problem can never go unnoticed again.
const TEST_PREFIX = /^t[0-9a-f]{8}-/;

export async function cleanup() {
  const db = admin();
  const { data: tenants, error } = await db.from("tenants").select("id, slug");
  if (error) throw new Error(`cleanup list tenants: ${error.message}`);
  const testTenantIds = tenants.filter((t) => TEST_PREFIX.test(t.slug)).map((t) => t.id);
  if (testTenantIds.length) {
    const { error: delError } = await db.from("tenants").delete().in("id", testTenantIds);
    if (delError) throw new Error(`cleanup delete tenants: ${delError.message}`);
  }

  const testUsers: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error: listError } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) throw new Error(`cleanup list users: ${listError.message}`);
    testUsers.push(...data.users.filter((u) => TEST_PREFIX.test(u.email ?? "")).map((u) => u.id));
    if (data.users.length < 200) break;
  }
  for (const id of testUsers) {
    const { error: userError } = await db.auth.admin.deleteUser(id);
    if (userError) throw new Error(`cleanup delete user: ${userError.message}`);
  }
}

export const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id).sort();
