-- Support access (SPEC 4.15): Bookeria's platform admins may VIEW a business only
-- while its owner allows it, for a limited time, and never change anything.
--
-- "Never change" is enforced by the database itself: support counts as an admin
-- only inside READ ONLY transactions. The API runs every plain read (GET) in such
-- a transaction, and PostgreSQL refuses any write in it — so no policy, function
-- or app bug can turn a support view into a change. Owner-only data (dental
-- treatment notes, owner-only settings) stays hidden: support is never "owner".

create table public.support_grants (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  granted_by  uuid references auth.users (id) on delete set null,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (expires_at > created_at)
);
create index on public.support_grants (tenant_id, expires_at desc);
alter table public.support_grants enable row level security;
alter table public.support_grants force row level security;
create trigger support_grants_updated_at before update on public.support_grants
  for each row execute function public.set_updated_at();

-- is the current user a platform admin with an open grant for this business,
-- inside a read-only transaction?
create or replace function public.support_view(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select current_setting('transaction_read_only', true) = 'on'
    and public.is_platform_admin()
    and exists (select 1 from public.support_grants g
                where g.tenant_id = p_tenant and g.revoked_at is null and g.expires_at > now())
$$;

create or replace function public.has_role(p_tenant uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant
      and m.status = 'active' and m.role = any (p_roles)
  )
  or ('admin' = any (p_roles) and public.support_view(p_tenant))
$$;

create or replace function public.user_tenant_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.tenant_id from public.memberships m
  where m.user_id = auth.uid() and m.status = 'active'
  union
  select g.tenant_id from public.support_grants g
  where g.revoked_at is null and g.expires_at > now() and public.support_view(g.tenant_id)
$$;

-- the owner sees their business's grants; platform admins see all
create policy support_grants_select on public.support_grants for select to authenticated
  using (public.has_role(tenant_id, array['owner']) or public.is_platform_admin());
-- no insert/update/delete policies: only through the functions below

create or replace function public.grant_support_access(p_tenant uuid, p_hours integer)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_until timestamptz;
begin
  if not public.has_role(p_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_hours not in (24, 72) then
    raise exception 'invalid duration' using errcode = '22023';
  end if;
  -- one open grant at a time: a new one replaces the old
  update public.support_grants set revoked_at = now()
  where tenant_id = p_tenant and revoked_at is null and expires_at > now();
  v_until := now() + make_interval(hours => p_hours);
  insert into public.support_grants (tenant_id, granted_by, expires_at)
  values (p_tenant, auth.uid(), v_until);
  perform public.write_audit(p_tenant, 'support.granted', 'tenant', p_tenant::text,
    jsonb_build_object('hours', p_hours, 'until', v_until));
  return v_until;
end;
$$;

create or replace function public.revoke_support_access(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.support_grants set revoked_at = now()
  where tenant_id = p_tenant and revoked_at is null and expires_at > now();
  if found then
    perform public.write_audit(p_tenant, 'support.revoked', 'tenant', p_tenant::text);
  end if;
end;
$$;

-- a platform admin opens the view: allowed only with an open grant, always logged
create or replace function public.start_support_view(p_tenant uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_until timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select max(g.expires_at) into v_until from public.support_grants g
  where g.tenant_id = p_tenant and g.revoked_at is null and g.expires_at > now();
  if v_until is null then
    raise exception 'no support access' using errcode = '42501';
  end if;
  perform public.write_audit(p_tenant, 'support.viewed', 'tenant', p_tenant::text);
  return v_until;
end;
$$;

grant select on public.support_grants to authenticated;
grant execute on function public.support_view(uuid) to authenticated;
grant execute on function public.grant_support_access(uuid, integer) to authenticated;
grant execute on function public.revoke_support_access(uuid) to authenticated;
grant execute on function public.start_support_view(uuid) to authenticated;
