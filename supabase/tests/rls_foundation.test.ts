// Tenant isolation for tenants, profiles, memberships, invitations, audit_log.
// Question every test answers: "if a user of business A edited the request in
// their browser, what could they see or change outside A?" Expected: nothing.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  cleanup,
  createTenant,
  createUser,
  ids,
  type TestTenant,
  type TestUser,
} from "./helpers";

let A: TestTenant;
let B: TestTenant;
let outsider: TestUser;

beforeAll(async () => {
  A = await createTenant("a", "salon");
  B = await createTenant("b", "dental");
  outsider = await createUser("outsider");
});

afterAll(async () => {
  await cleanup();
});

describe("tenants", () => {
  it("each role reads its own tenant and nothing else", async () => {
    for (const user of [A.owner, A.adminUser, A.staff]) {
      const { data, error } = await user.db.from("tenants").select("id");
      expect(error).toBeNull();
      expect(ids(data)).toEqual([A.id]);
    }
  });

  it("asking for tenant B by id returns no rows", async () => {
    const { data, error } = await A.owner.db.from("tenants").select("id").eq("id", B.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a user without a business sees no tenants", async () => {
    const { data } = await outsider.db.from("tenants").select("id");
    expect(data).toEqual([]);
  });

  it("nobody can insert a tenant directly", async () => {
    const { error } = await A.owner.db
      .from("tenants")
      .insert({ name: "Sneaky", type: "salon", slug: `${A.slug}-sneaky` });
    expect(error).not.toBeNull();
  });

  it("owner of A cannot update B", async () => {
    const { data } = await A.owner.db.from("tenants").update({ name: "Hacked" }).eq("id", B.id).select("id");
    expect(data ?? []).toEqual([]);
    const { data: b } = await admin().from("tenants").select("name").eq("id", B.id).single();
    expect(b?.name).not.toBe("Hacked");
  });

  it("only the owner may update the business; admin and staff cannot", async () => {
    for (const user of [A.adminUser, A.staff]) {
      const { data } = await user.db.from("tenants").update({ name: "Renamed" }).eq("id", A.id).select("id");
      expect(data ?? []).toEqual([]);
    }
    const { data } = await A.owner.db
      .from("tenants")
      .update({ name: `Test a renamed` })
      .eq("id", A.id)
      .select("id");
    expect(ids(data)).toEqual([A.id]);
  });

  it("owner cannot change plan, status or slug", async () => {
    for (const patch of [{ plan: "pro" }, { status: "active" as const }, { slug: "taken-over" }]) {
      const { error } = await A.owner.db.from("tenants").update(patch).eq("id", A.id);
      expect(error?.code).toBe("42501");
    }
  });

  it("owner cannot delete the business directly", async () => {
    await A.owner.db.from("tenants").delete().eq("id", A.id);
    const { data } = await admin().from("tenants").select("id").eq("id", A.id);
    expect(ids(data)).toEqual([A.id]);
  });
});

describe("memberships", () => {
  it("members see only their own tenant's memberships", async () => {
    const { data } = await A.staff.db.from("memberships").select("id, tenant_id");
    expect(data?.length).toBe(3);
    expect(new Set(data?.map((m) => m.tenant_id))).toEqual(new Set([A.id]));
  });

  it("cannot add yourself to another tenant", async () => {
    const { error } = await A.owner.db
      .from("memberships")
      .insert({ tenant_id: B.id, user_id: A.owner.id, role: "owner" });
    expect(error).not.toBeNull();
    const { data } = await admin()
      .from("memberships")
      .select("id")
      .eq("tenant_id", B.id)
      .eq("user_id", A.owner.id);
    expect(data).toEqual([]);
  });

  it("owner of A cannot change or remove B's members", async () => {
    const { data: updated } = await A.owner.db
      .from("memberships")
      .update({ role: "staff" })
      .eq("tenant_id", B.id)
      .select("id");
    expect(updated ?? []).toEqual([]);
    await A.owner.db.from("memberships").delete().eq("tenant_id", B.id);
    const { data } = await admin().from("memberships").select("id").eq("tenant_id", B.id);
    expect(data?.length).toBe(3);
  });

  it("admin and staff cannot change roles", async () => {
    for (const user of [A.adminUser, A.staff]) {
      const { data } = await user.db
        .from("memberships")
        .update({ role: "owner" })
        .eq("tenant_id", A.id)
        .select("id");
      expect(data ?? []).toEqual([]);
    }
  });

  it("owner can change a staff member's role, and it is audited", async () => {
    const { data } = await A.owner.db
      .from("memberships")
      .update({ role: "admin" })
      .eq("tenant_id", A.id)
      .eq("user_id", A.staff.id)
      .select("id");
    expect(data?.length).toBe(1);
    await A.owner.db
      .from("memberships")
      .update({ role: "staff" })
      .eq("tenant_id", A.id)
      .eq("user_id", A.staff.id);

    const { data: log } = await A.owner.db
      .from("audit_log")
      .select("action")
      .eq("tenant_id", A.id)
      .eq("action", "membership.updated");
    expect(log?.length).toBeGreaterThanOrEqual(2);
  });

  it("membership cannot be moved to another tenant or user", async () => {
    const { error } = await A.owner.db
      .from("memberships")
      .update({ tenant_id: B.id })
      .eq("tenant_id", A.id)
      .eq("user_id", A.staff.id);
    expect(error?.code).toBe("42501");
  });

  it("the last owner cannot be demoted, even with the service key", async () => {
    const { error } = await admin()
      .from("memberships")
      .update({ role: "admin" })
      .eq("tenant_id", A.id)
      .eq("user_id", A.owner.id);
    expect(error?.message).toMatch(/at least one owner/);
  });
});

describe("profiles", () => {
  it("members see colleagues' profiles but not other tenants' people", async () => {
    const { data } = await A.staff.db.from("profiles").select("id");
    expect(ids(data)).toEqual([A.owner.id, A.adminUser.id, A.staff.id].sort());
  });

  it("users can edit only their own profile", async () => {
    const { data: own } = await A.staff.db
      .from("profiles")
      .update({ full_name: "Staff A" })
      .eq("id", A.staff.id)
      .select("id");
    expect(own?.length).toBe(1);
    for (const target of [A.owner.id, B.owner.id]) {
      const { data } = await A.staff.db
        .from("profiles")
        .update({ full_name: "Hacked" })
        .eq("id", target)
        .select("id");
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("invitations", () => {
  it("owner and admin see only their tenant's invitations; staff see none", async () => {
    for (const user of [A.owner, A.adminUser]) {
      const { data } = await user.db.from("invitations").select("tenant_id");
      expect(data?.length).toBeGreaterThan(0);
      expect(new Set(data?.map((i) => i.tenant_id))).toEqual(new Set([A.id]));
    }
    const { data } = await A.staff.db.from("invitations").select("id");
    expect(data).toEqual([]);
  });

  it("cannot invite into another tenant, and staff cannot invite at all", async () => {
    const intoB = await A.owner.db.rpc("create_invitation", {
      p_tenant: B.id,
      p_email: "x@example.test",
      p_role: "admin",
    });
    expect(intoB.error?.code).toBe("42501");
    const byStaff = await A.staff.db.rpc("create_invitation", {
      p_tenant: A.id,
      p_email: "y@example.test",
      p_role: "staff",
    });
    expect(byStaff.error?.code).toBe("42501");
  });

  it("an invitation cannot grant the owner role", async () => {
    const { error } = await A.owner.db.rpc("create_invitation", {
      p_tenant: A.id,
      p_email: "z@example.test",
      p_role: "owner",
    });
    expect(error).not.toBeNull();
  });

  it("stores only a hash of the token", async () => {
    const { data } = await admin().from("invitations").select("token_hash").eq("tenant_id", A.id);
    expect(data?.some((i) => i.token_hash === A.openInviteToken)).toBe(false);
  });

  it("the invite page can preview with the token, and nothing without it", async () => {
    const { data } = await anon().rpc("get_invitation", { p_token: A.openInviteToken });
    expect(data?.[0]?.status).toBe("open");
    const { data: none } = await anon().rpc("get_invitation", { p_token: "not-a-token" });
    expect(none).toEqual([]);
  });

  it("an invitation only works for the invited email", async () => {
    const { error } = await outsider.db.rpc("accept_invitation", { p_token: A.openInviteToken });
    expect(error).not.toBeNull();
    const { data } = await outsider.db.from("tenants").select("id");
    expect(data).toEqual([]);
  });

  it("admin of A cannot revoke B's invitation", async () => {
    const { data: inv } = await admin()
      .from("invitations")
      .select("id")
      .eq("tenant_id", B.id)
      .is("accepted_at", null)
      .single();
    const { error } = await A.adminUser.db.rpc("revoke_invitation", { p_invitation: inv!.id });
    expect(error?.code).toBe("42501");
  });

  it("users cannot write invitations directly", async () => {
    const { error } = await A.owner.db
      .from("invitations")
      .insert({ tenant_id: A.id, email: "d@example.test", role: "staff", token_hash: "x" });
    expect(error).not.toBeNull();
  });
});

describe("audit_log", () => {
  it("owner sees own tenant's log, including business creation", async () => {
    const { data } = await A.owner.db.from("audit_log").select("tenant_id, action");
    expect(data?.some((r) => r.action === "tenant.created")).toBe(true);
    expect(new Set(data?.map((r) => r.tenant_id))).toEqual(new Set([A.id]));
  });

  it("admin and staff cannot read the audit log", async () => {
    for (const user of [A.adminUser, A.staff]) {
      const { data } = await user.db.from("audit_log").select("id");
      expect(data).toEqual([]);
    }
  });

  it("nobody can write, change or delete audit entries directly", async () => {
    const insert = await A.owner.db
      .from("audit_log")
      .insert({ tenant_id: A.id, action: "fake", entity: "x" });
    expect(insert.error).not.toBeNull();
    const update = await A.owner.db.from("audit_log").update({ action: "edited" }).eq("tenant_id", A.id);
    expect(update.error).not.toBeNull();
    const del = await A.owner.db.from("audit_log").delete().eq("tenant_id", A.id);
    expect(del.error).not.toBeNull();
  });

  it("log_audit writes to your own tenant only", async () => {
    const own = await A.staff.db.rpc("log_audit", {
      p_tenant: A.id,
      p_action: "test.ping",
      p_entity: "test",
    });
    expect(own.error).toBeNull();
    const other = await A.owner.db.rpc("log_audit", {
      p_tenant: B.id,
      p_action: "test.ping",
      p_entity: "test",
    });
    expect(other.error?.code).toBe("42501");
  });
});

describe("anonymous visitors", () => {
  it("cannot read any table", async () => {
    const db = anon();
    for (const table of ["tenants", "profiles", "memberships", "invitations", "audit_log"] as const) {
      const { data } = await db.from(table).select("*");
      expect(data ?? []).toEqual([]);
    }
  });

  it("cannot create a business", async () => {
    const { error } = await anon().rpc("create_tenant", {
      p_name: "Anon",
      p_type: "salon",
      p_slug: "anon-x1",
    });
    expect(error).not.toBeNull();
  });
});
