// Demo data for the dev project: one salon and one dental clinic, each with an
// owner, an administrator and a staff member. Safe to re-run: it removes the
// previous demo data first. Never run against production.
//
//   npm run db:seed
//
// Demo sign-ins (dev only), password for all of them: Demo-Bookeria-2026
//   salon.owner@demo.test   salon.admin@demo.test   salon.staff@demo.test
//   dental.owner@demo.test  dental.admin@demo.test  dental.doctor@demo.test
//
// Services, staff schedules and clients are added to this seed in Phase 1.

import { createClient } from "@supabase/supabase-js";

const DEMO_PASSWORD = "Demo-Bookeria-2026";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}
if (process.env.ALLOW_SEED !== "dev" && /prod/i.test(url)) {
  console.error("Refusing to seed something that looks like production.");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

type Role = "owner" | "admin" | "staff";

const tenants = [
  {
    slug: "demo-salon",
    name: "სალონი ნინო",
    type: "salon",
    people: [
      { email: "salon.owner@demo.test", name: "ნინო ბერიძე", role: "owner" },
      { email: "salon.admin@demo.test", name: "მარიამ კაპანაძე", role: "admin" },
      { email: "salon.staff@demo.test", name: "ანა გელაშვილი", role: "staff" },
    ],
  },
  {
    slug: "demo-dental",
    name: "დენტალ სმაილი",
    type: "dental",
    people: [
      { email: "dental.owner@demo.test", name: "გიორგი ლომიძე", role: "owner" },
      { email: "dental.admin@demo.test", name: "თამარ ჩხეიძე", role: "admin" },
      { email: "dental.doctor@demo.test", name: "დავით მაისურაძე", role: "staff" },
    ],
  },
] as const satisfies readonly {
  slug: string;
  name: string;
  type: "salon" | "dental";
  people: readonly { email: string; name: string; role: Role }[];
}[];

function check<T>(
  label: string,
  result: { data: T; error: { message: string } | null },
): NonNullable<T> | null {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? null;
}

function must<T>(label: string, result: { data: T; error: { message: string } | null }): NonNullable<T> {
  const data = check(label, result);
  if (data === null) throw new Error(`${label}: no data returned`);
  return data;
}

async function removePreviousDemo() {
  const slugs = tenants.map((t) => t.slug);
  check("delete demo tenants", await db.from("tenants").delete().in("slug", slugs));

  const emails = new Set<string>(tenants.flatMap((t) => t.people.map((p) => p.email)));
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && emails.has(u.email)) await db.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
  }
}

async function seed() {
  await removePreviousDemo();

  for (const t of tenants) {
    const userIds: Record<string, string> = {};
    for (const p of t.people) {
      const { data, error } = await db.auth.admin.createUser({
        email: p.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: p.name, locale: "ka" },
      });
      if (error || !data.user) throw new Error(`create ${p.email}: ${error?.message}`);
      userIds[p.email] = data.user.id;
    }

    const owner = t.people.find((p) => p.role === "owner")!;
    const tenant = must(
      `tenant ${t.slug}`,
      await db
        .from("tenants")
        .insert({ slug: t.slug, name: t.name, type: t.type, created_by: userIds[owner.email] })
        .select("id")
        .single(),
    );

    check(
      `memberships ${t.slug}`,
      await db
        .from("memberships")
        .insert(t.people.map((p) => ({ tenant_id: tenant.id, user_id: userIds[p.email], role: p.role }))),
    );
    check(
      `audit ${t.slug}`,
      await db.from("audit_log").insert({
        tenant_id: tenant.id,
        action: "tenant.seeded",
        entity: "tenant",
        entity_id: tenant.id,
      }),
    );
    console.log(`✓ ${t.name} (${t.type}) — /book/${t.slug} — ${t.people.length} people`);
  }
}

seed().then(
  () => console.log("Seed complete."),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
