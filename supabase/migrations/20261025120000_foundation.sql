-- Phase 0 foundation: tenants, profiles, memberships, invitations, audit_log.
-- Every table has RLS on and forced. Writes that must be atomic or that cross
-- tables (create business, invite, accept) go through security-definer RPCs.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 2 and 120),
  type            text not null check (type in ('salon', 'dental')),
  slug            text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'),
  timezone        text not null default 'Asia/Tbilisi',
  currency        text not null default 'GEL' check (currency = 'GEL'),
  locale_default  text not null default 'ka' check (locale_default in ('ka', 'en', 'ru')),
  plan            text not null default 'trial',
  status          text not null default 'trial'
                  check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  trial_ends_at   timestamptz not null default (now() + interval '14 days'),
  settings        jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  locale      text not null default 'ka' check (locale in ('ka', 'en', 'ru')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'staff')),
  staff_id    uuid, -- linked to public.staff in Phase 1
  status      text not null default 'active' check (status in ('active', 'disabled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role         text not null check (role in ('admin', 'staff')),
  token_hash   text not null unique,
  invited_by   uuid references auth.users (id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  meta       jsonb not null default '{}'::jsonb,
  ip         inet,
  at         timestamptz not null default now()
);

create index memberships_tenant_id_idx on public.memberships (tenant_id);
create index memberships_user_id_idx on public.memberships (user_id);
create index invitations_tenant_id_idx on public.invitations (tenant_id);
create unique index invitations_one_open_per_email
  on public.invitations (tenant_id, email)
  where accepted_at is null and revoked_at is null;
create index audit_log_tenant_at_idx on public.audit_log (tenant_id, at desc);

create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger invitations_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

alter table public.tenants     enable row level security;
alter table public.profiles    enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log   enable row level security;
alter table public.tenants     force row level security;
alter table public.profiles    force row level security;
alter table public.memberships force row level security;
alter table public.invitations force row level security;
alter table public.audit_log   force row level security;

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------

create or replace function public.user_tenant_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.tenant_id from public.memberships m
  where m.user_id = auth.uid() and m.status = 'active'
$$;

create or replace function public.has_role(p_tenant uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant
      and m.status = 'active' and m.role = any (p_roles)
  )
$$;

-- users who share at least one active tenant with the current user
create or replace function public.shares_tenant_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = p_user
  )
$$;

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon; authenticated gets only what policies allow
-- ---------------------------------------------------------------------------

revoke all on public.tenants, public.profiles, public.memberships,
  public.invitations, public.audit_log from anon, authenticated;

grant select on public.tenants, public.profiles, public.memberships,
  public.invitations, public.audit_log to authenticated;
-- Plan, status, trial and slug are platform-controlled: not in this list.
grant update (name, timezone, locale_default, settings) on public.tenants to authenticated;
grant update (full_name, phone, locale) on public.profiles to authenticated;
grant update (role, status) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (one per command; no insert policies: inserts go through RPCs)
-- ---------------------------------------------------------------------------

create policy tenants_select on public.tenants for select to authenticated
  using (id in (select public.user_tenant_ids()));
create policy tenants_update on public.tenants for update to authenticated
  using (public.has_role(id, array['owner']))
  with check (public.has_role(id, array['owner']));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_tenant_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy memberships_select on public.memberships for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));
create policy memberships_update on public.memberships for update to authenticated
  using (public.has_role(tenant_id, array['owner']) and user_id <> auth.uid())
  with check (public.has_role(tenant_id, array['owner']) and user_id <> auth.uid());
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.has_role(tenant_id, array['owner']) and user_id <> auth.uid());

create policy invitations_select on public.invitations for select to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']));

create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_role(tenant_id, array['owner']));

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

-- internal: callers have already checked access
create or replace function public.write_audit(
  p_tenant uuid, p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (tenant_id, actor_id, action, entity, entity_id, meta)
  values (p_tenant, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb))
$$;

-- for app code: only members may log into their own tenant
create or replace function public.log_audit(
  p_tenant uuid, p_action text, p_entity text, p_entity_id text default null, p_meta jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_tenant, array['owner', 'admin', 'staff']) then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;
  perform public.write_audit(p_tenant, p_action, p_entity, p_entity_id, p_meta);
end;
$$;

-- membership changes are always audited, whoever makes them
create or replace function public.audit_membership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    perform public.write_audit(new.tenant_id, 'membership.updated', 'membership', new.id::text,
      jsonb_build_object('user_id', new.user_id, 'from_role', old.role, 'to_role', new.role,
                         'from_status', old.status, 'to_status', new.status));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_audit(old.tenant_id, 'membership.removed', 'membership', old.id::text,
      jsonb_build_object('user_id', old.user_id, 'role', old.role));
    return old;
  end if;
  return null;
end;
$$;

create trigger memberships_audit after update or delete on public.memberships
  for each row execute function public.audit_membership_change();

-- a business must always keep at least one active owner
create or replace function public.keep_one_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := coalesce(old.tenant_id, new.tenant_id);
begin
  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     and exists (select 1 from public.tenants t where t.id = v_tenant)
     and not exists (
       select 1 from public.memberships m
       where m.tenant_id = v_tenant and m.id <> old.id
         and m.role = 'owner' and m.status = 'active'
     ) then
    raise exception 'a business must keep at least one owner' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_owner before update or delete on public.memberships
  for each row execute function public.keep_one_owner();

-- ---------------------------------------------------------------------------
-- New users get a profile
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_locale text := new.raw_user_meta_data ->> 'locale';
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    case when v_locale in ('ka', 'en', 'ru') then v_locale else 'ka' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: create a business (tenant + owner membership + audit, atomically)
-- ---------------------------------------------------------------------------

create or replace function public.create_tenant(
  p_name text, p_type text, p_slug text, p_locale text default 'ka'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships m where m.user_id = v_user and m.role = 'owner') >= 5 then
    raise exception 'too many businesses' using errcode = 'P0001';
  end if;

  insert into public.tenants (name, type, slug, locale_default, created_by)
  values (btrim(p_name), p_type, lower(btrim(p_slug)),
          case when p_locale in ('ka', 'en', 'ru') then p_locale else 'ka' end, v_user)
  returning id into v_tenant;

  insert into public.memberships (tenant_id, user_id, role) values (v_tenant, v_user, 'owner');
  perform public.write_audit(v_tenant, 'tenant.created', 'tenant', v_tenant::text,
    jsonb_build_object('type', p_type));
  return v_tenant;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: invitations
-- The raw token exists only in the invite link; the DB stores its SHA-256.
-- ---------------------------------------------------------------------------

create or replace function public.create_invitation(p_tenant uuid, p_email text, p_role text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  if not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant and lower(u.email) = v_email
  ) then
    raise exception 'already a member' using errcode = 'P0002';
  end if;

  -- inviting the same email again replaces the old open invitation
  update public.invitations set revoked_at = now()
  where tenant_id = p_tenant and email = v_email and accepted_at is null and revoked_at is null;

  insert into public.invitations (tenant_id, email, role, token_hash, invited_by)
  values (p_tenant, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid())
  returning id into v_id;

  perform public.write_audit(p_tenant, 'invitation.created', 'invitation', v_id::text,
    jsonb_build_object('email', v_email, 'role', p_role));
  return v_token;
end;
$$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.invitations
  where id = p_invitation and accepted_at is null and revoked_at is null;
  if v_tenant is null or not public.has_role(v_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now() where id = p_invitation;
  perform public.write_audit(v_tenant, 'invitation.revoked', 'invitation', p_invitation::text);
end;
$$;

-- What the invite page shows before sign-in. Knowing the token is the permission.
create or replace function public.get_invitation(p_token text)
returns table (business_name text, business_type text, email text, role text, status text)
language sql stable security definer set search_path = '' as $$
  select t.name, t.type, i.email, i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'open'
    end
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.invitations;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user;

  select * into v_inv from public.invitations
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if v_inv.id is null or v_inv.accepted_at is not null or v_inv.revoked_at is not null
     or v_inv.expires_at < now() then
    raise exception 'invitation not valid' using errcode = 'P0002';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation is for another email' using errcode = '42501';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_inv.tenant_id, v_user, v_inv.role)
  on conflict (tenant_id, user_id) do nothing;

  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  perform public.write_audit(v_inv.tenant_id, 'invitation.accepted', 'invitation', v_inv.id::text,
    jsonb_build_object('role', v_inv.role));
  return v_inv.tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.user_tenant_ids() to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
grant execute on function public.shares_tenant_with(uuid) to authenticated;
grant execute on function public.log_audit(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.create_tenant(text, text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- new functions in later migrations must be granted explicitly
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
