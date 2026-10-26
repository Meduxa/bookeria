-- Phase 6a: plans and limits, platform admin, business deletion with a grace
-- period, trial expiry, full business export, business photos.

-- ---------------------------------------------------------------------------
-- Platform admins (Levan). Added with scripts/platform-admin.mts, never from the app.
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Plans (placeholders until Levan sets names, prices and limits in the admin area)
-- ---------------------------------------------------------------------------
create table public.plans (
  code             text primary key check (code ~ '^[a-z0-9_-]{2,30}$'),
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  price_minor      integer not null default 0 check (price_minor >= 0),   -- GEL tetri per month
  max_staff        integer check (max_staff is null or max_staff >= 1),   -- null = no limit
  sms_per_month    integer not null default 0 check (sms_per_month >= 0),
  active           boolean not null default true,                         -- offered to new businesses
  sort_order       integer not null default 0,
  updated_at       timestamptz not null default now()
);
alter table public.plans enable row level security;
alter table public.plans force row level security;
revoke all on public.plans from anon;
revoke truncate, references, trigger on public.plans from authenticated;
create policy plans_select on public.plans for select to authenticated using (true);
create policy plans_insert on public.plans for insert to authenticated with check (public.is_platform_admin());
create policy plans_update on public.plans for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy plans_delete on public.plans for delete to authenticated using (public.is_platform_admin());

insert into public.plans (code, name, max_staff, sms_per_month, sort_order) values
  ('trial', 'Trial', null, 0, 0),
  ('start', 'Start', 2, 100, 1),
  ('pro', 'Pro', 10, 300, 2),
  ('clinic', 'Clinic', 10, 300, 3);
alter table public.tenants
  add constraint tenants_plan_fk foreign key (plan) references public.plans (code) on update cascade;

-- Staff limit of the plan (active staff only).
create or replace function public.enforce_staff_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_max integer;
begin
  if not new.active then return new; end if;
  if tg_op = 'UPDATE' and old.active then return new; end if;
  select p.max_staff into v_max from public.tenants t join public.plans p on p.code = t.plan where t.id = new.tenant_id;
  if v_max is not null and (select count(*) from public.staff where tenant_id = new.tenant_id and active and id <> new.id) >= v_max then
    raise exception 'plan staff limit' using errcode = 'P0006';
  end if;
  return new;
end;
$$;
create trigger staff_plan_limit before insert or update of active on public.staff
  for each row execute function public.enforce_staff_limit();

-- ---------------------------------------------------------------------------
-- Business deletion: owner asks, 14 days to change their mind, then it is purged.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column deletion_requested_at timestamptz,
  add column deletion_due_at       timestamptz;

create or replace function public.request_tenant_deletion(p_tenant uuid, p_confirm_name text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_name text; v_due timestamptz := now() + interval '14 days';
begin
  if not public.has_role(p_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select name into v_name from public.tenants where id = p_tenant;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then
    raise exception 'name does not match' using errcode = '22023';
  end if;
  update public.tenants set deletion_requested_at = now(), deletion_due_at = v_due where id = p_tenant;
  perform public.write_audit(p_tenant, 'tenant.deletion_requested', 'tenant', p_tenant::text,
    jsonb_build_object('due', v_due));
  return v_due;
end;
$$;

create or replace function public.cancel_tenant_deletion(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.tenants set deletion_requested_at = null, deletion_due_at = null where id = p_tenant;
  perform public.write_audit(p_tenant, 'tenant.deletion_cancelled', 'tenant', p_tenant::text);
end;
$$;

-- Daily job (server key): purge businesses past their date; end trials.
create or replace function public.purge_due_tenants()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.tenants where deletion_due_at is not null and deletion_due_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.expire_trials()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.tenants set status = 'past_due' where status = 'trial' and trial_ends_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Full business export (owner): everything the business stored, as JSON.
-- Treatment notes are excluded on purpose (health data stays in the clinic's
-- per-patient export, decision in CLAUDE.md 3.3).
-- ---------------------------------------------------------------------------
create or replace function public.export_tenant(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.has_role(p_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'business', (select to_jsonb(t) - 'settings' from public.tenants t where t.id = p_tenant),
    'settings', (select to_jsonb(s) from public.tenant_settings s where s.tenant_id = p_tenant),
    'locations', coalesce((select jsonb_agg(to_jsonb(l)) from public.locations l where l.tenant_id = p_tenant), '[]'),
    'services', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.services x where x.tenant_id = p_tenant), '[]'),
    'staff', coalesce((select jsonb_agg(to_jsonb(x)) from public.staff x where x.tenant_id = p_tenant), '[]'),
    'clients', coalesce((select jsonb_agg(to_jsonb(x)) from public.clients x where x.tenant_id = p_tenant), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(x)) from public.client_consents x where x.tenant_id = p_tenant), '[]'),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object('items',
                  (select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.booking_items i where i.booking_id = b.id)))
                  from public.bookings b where b.tenant_id = p_tenant), '[]'),
    'payments', coalesce((select jsonb_agg(to_jsonb(x)) from public.payments x where x.tenant_id = p_tenant), '[]'),
    'sms_messages', coalesce((select jsonb_agg(to_jsonb(x) - 'body') from public.sms_messages x where x.tenant_id = p_tenant), '[]')
  ) into v;
  perform public.write_audit(p_tenant, 'tenant.exported', 'tenant', p_tenant::text);
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform admin functions (check is_platform_admin inside)
-- ---------------------------------------------------------------------------
create or replace function public.admin_tenants()
returns table (
  id uuid, name text, slug text, type text, plan text, status text, trial_ends_at timestamptz,
  created_at timestamptz, deletion_due_at timestamptz, staff_count bigint, bookings_30d bigint,
  sms_balance bigint, last_activity timestamptz, owner_email text
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select t.id, t.name, t.slug, t.type, t.plan, t.status, t.trial_ends_at, t.created_at, t.deletion_due_at,
    (select count(*) from public.staff s where s.tenant_id = t.id and s.active),
    (select count(*) from public.bookings b where b.tenant_id = t.id and b.created_at > now() - interval '30 days'),
    (select coalesce(sum(l.delta), 0) from public.sms_credit_ledger l where l.tenant_id = t.id),
    greatest(t.updated_at, (select max(a.created_at) from public.audit_log a where a.tenant_id = t.id),
             (select max(b.created_at) from public.bookings b where b.tenant_id = t.id)),
    (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id
      where m.tenant_id = t.id and m.role = 'owner' order by m.created_at limit 1)
  from public.tenants t
  order by t.created_at desc;
end;
$$;

create or replace function public.admin_update_tenant(p_tenant uuid, p_plan text, p_status text, p_trial_ends_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.tenants set plan = p_plan, status = p_status, trial_ends_at = p_trial_ends_at, updated_at = now()
  where id = p_tenant;
  perform public.write_audit(p_tenant, 'platform.tenant_updated', 'tenant', p_tenant::text,
    jsonb_build_object('plan', p_plan, 'status', p_status, 'trial_ends_at', p_trial_ends_at));
end;
$$;

create or replace function public.admin_topup_sms(p_tenant uuid, p_segments integer, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_segments = 0 or abs(p_segments) > 100000 then raise exception 'invalid amount' using errcode = '22023'; end if;
  insert into public.sms_credit_ledger (tenant_id, delta, reason, note)
  values (p_tenant, p_segments, case when p_segments > 0 then 'topup' else 'adjust' end, left(p_note, 200));
  perform public.write_audit(p_tenant, 'platform.sms_topup', 'tenant', p_tenant::text,
    jsonb_build_object('segments', p_segments, 'note', p_note));
end;
$$;

create or replace function public.admin_sms_log(p_status text default null, p_limit integer default 100)
returns table (id uuid, tenant text, created_at timestamptz, to_phone text, type text, status text,
               segments integer, error_code text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select m.id, t.name, m.created_at, m.to_phone, m.type, m.status, m.segments, m.error_code
  from public.sms_messages m join public.tenants t on t.id = m.tenant_id
  where p_status is null or m.status = p_status
  order by m.created_at desc limit least(p_limit, 500);
end;
$$;

-- ---------------------------------------------------------------------------
-- Business photos for the booking page (public bucket, owner/admin write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-photos', 'business-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy business_photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'business-photos' and public.can_write_tenant_folder(name));
create policy business_photos_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'business-photos' and public.can_write_tenant_folder(name))
  with check (bucket_id = 'business-photos' and public.can_write_tenant_folder(name));
create policy business_photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'business-photos' and public.can_write_tenant_folder(name));

create table public.business_photos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  path        text not null check (char_length(path) between 3 and 300),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.business_photos (tenant_id, sort_order);
alter table public.business_photos enable row level security;
alter table public.business_photos force row level security;
revoke all on public.business_photos from anon;
revoke truncate, references, trigger on public.business_photos from authenticated;
create policy business_photos_select on public.business_photos for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));
create policy business_photos_insert on public.business_photos for insert to authenticated
  with check (public.has_role(tenant_id, array['owner', 'admin']) and split_part(path, '/', 1) = tenant_id::text);
create policy business_photos_update on public.business_photos for update to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']))
  with check (public.has_role(tenant_id, array['owner', 'admin']) and split_part(path, '/', 1) = tenant_id::text);
create policy business_photos_delete on public.business_photos for delete to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']));
create trigger business_photos_tenant_fixed before update on public.business_photos
  for each row execute function public.prevent_tenant_change();

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.request_tenant_deletion(uuid, text)',
    'public.cancel_tenant_deletion(uuid)',
    'public.export_tenant(uuid)',
    'public.admin_tenants()',
    'public.admin_update_tenant(uuid, text, text, timestamptz)',
    'public.admin_topup_sms(uuid, integer, text)',
    'public.admin_sms_log(text, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['public.purge_due_tenants()', 'public.expire_trials()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
