-- Phase 3a: bookings, booking items, status history, dental notes.
--
-- * Writes go only through security-definer RPCs: they compute price/duration
--   snapshots on the server and enforce "staff may change only their own
--   bookings". Users get SELECT only.
-- * Double booking is impossible: exclusion constraints on active items per
--   staff member and per resource (booking-engine skill).

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  location_id      uuid,
  client_id        uuid,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null check (ends_at > starts_at),
  status           text not null default 'confirmed' check (status in (
                     'pending', 'confirmed', 'arrived', 'in_progress', 'completed',
                     'cancelled_by_client', 'cancelled_by_business', 'no_show')),
  source           text not null default 'admin' check (source in ('admin', 'online', 'phone', 'walk_in', 'import')),
  internal_note    text check (char_length(internal_note) <= 2000),
  client_comment   text check (char_length(client_comment) <= 1000),
  cancel_reason    text check (char_length(cancel_reason) <= 300),
  discount_minor   integer not null default 0 check (discount_minor >= 0),
  total_minor      integer not null default 0 check (total_minor >= 0),
  paid_minor       integer not null default 0 check (paid_minor >= 0),
  currency         text not null default 'GEL' check (currency = 'GEL'),
  deposit_status   text not null default 'none' check (deposit_status in ('none', 'required', 'paid', 'refunded')),
  recurrence_id    uuid,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete set null (location_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete set null (client_id)
);

create table public.booking_items (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants (id) on delete cascade,
  booking_id             uuid not null,
  service_id             uuid,
  variant_id             uuid,
  staff_id               uuid not null,
  resource_id            uuid,
  name_snapshot          text not null,
  price_type_snapshot    text not null check (price_type_snapshot in ('fixed', 'from', 'range')),
  price_minor_snapshot   integer not null check (price_minor_snapshot >= 0),
  duration_min_snapshot  integer not null check (duration_min_snapshot between 5 and 720),
  buffer_min_snapshot    integer not null default 0 check (buffer_min_snapshot between 0 and 240),
  starts_at              timestamptz not null,
  ends_at                timestamptz not null check (ends_at > starts_at),
  blocked_until          timestamptz not null check (blocked_until >= ends_at),
  active                 boolean not null default true,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade,
  foreign key (service_id, tenant_id) references public.services (id, tenant_id) on delete set null (service_id),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete no action,
  foreign key (resource_id, tenant_id) references public.resources (id, tenant_id) on delete set null (resource_id),
  constraint no_staff_overlap exclude using gist (
    tenant_id with =, staff_id with =, tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (active),
  constraint no_resource_overlap exclude using gist (
    tenant_id with =, resource_id with =, tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (active and resource_id is not null)
);

create table public.booking_status_history (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  booking_id   uuid not null,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references auth.users (id) on delete set null,
  changed_at   timestamptz not null default now(),
  reason       text,
  meta         jsonb not null default '{}'::jsonb,
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);

-- Health data (special category): no direct table access at all; read and
-- write through audited functions only.
create table public.dental_notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  client_id   uuid not null,
  booking_id  uuid,
  author_id   uuid references auth.users (id) on delete set null,
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now(),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete set null (booking_id)
);

create index bookings_tenant_starts on public.bookings (tenant_id, starts_at);
create index bookings_client on public.bookings (tenant_id, client_id, starts_at desc);
create index booking_items_staff_starts on public.booking_items (tenant_id, staff_id, starts_at);
create index booking_items_booking on public.booking_items (booking_id);
create index booking_status_history_booking on public.booking_status_history (booking_id, changed_at);
create index dental_notes_client on public.dental_notes (tenant_id, client_id, created_at desc);

create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
create trigger booking_items_updated_at before update on public.booking_items for each row execute function public.set_updated_at();
create trigger bookings_tenant_fixed before update on public.bookings for each row execute function public.prevent_tenant_change();
create trigger booking_items_tenant_fixed before update on public.booking_items for each row execute function public.prevent_tenant_change();

do $$
declare t text;
begin
  foreach t in array array['bookings', 'booking_items', 'booking_status_history', 'dental_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

grant select on public.bookings, public.booking_items, public.booking_status_history to authenticated;

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------

-- owner/admin: everything; staff: bookings with an item of theirs, or all if
-- the business allows it
create or replace function public.can_see_booking(p_tenant uuid, p_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_tenant, array['owner', 'admin'])
    or (public.has_role(p_tenant, array['staff']) and (
      coalesce((select s.staff_sees_all_bookings from public.tenant_settings s where s.tenant_id = p_tenant), false)
      or exists (select 1 from public.booking_items i
                 where i.booking_id = p_booking and i.staff_id = public.current_staff_id(p_tenant))
    ))
$$;

create policy bookings_select on public.bookings for select to authenticated
  using (public.can_see_booking(tenant_id, id));
create policy booking_items_select on public.booking_items for select to authenticated
  using (public.can_see_booking(tenant_id, booking_id));
create policy booking_status_history_select on public.booking_status_history for select to authenticated
  using (public.can_see_booking(tenant_id, booking_id));
-- dental_notes: no policies on purpose

-- Staff now also see clients who have a booking with them.
create or replace function public.can_see_client(p_tenant uuid, p_preferred_staff uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_tenant, array['owner', 'admin'])
    or (public.has_role(p_tenant, array['staff']) and (
      coalesce((select s.staff_sees_all_clients from public.tenant_settings s where s.tenant_id = p_tenant), false)
      or (p_preferred_staff is not null and p_preferred_staff = public.current_staff_id(p_tenant))
    ))
$$;

create or replace function public.staff_has_client(p_tenant uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b join public.booking_items i on i.booking_id = b.id
    where b.tenant_id = p_tenant and b.client_id = p_client
      and i.staff_id = public.current_staff_id(p_tenant)
  )
$$;

drop policy clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
  using (public.can_see_client(tenant_id, preferred_staff_id)
         or (public.has_role(tenant_id, array['staff']) and public.staff_has_client(tenant_id, id)));

-- ---------------------------------------------------------------------------
-- Booking RPCs
-- ---------------------------------------------------------------------------

-- May the caller write bookings for these staff members? owner/admin: yes;
-- staff: only when every staff id is their own profile.
create or replace function public.may_book_for(p_tenant uuid, p_staff uuid[])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_tenant, array['owner', 'admin'])
    or (public.has_role(p_tenant, array['staff'])
        and public.current_staff_id(p_tenant) is not null
        and p_staff <@ array[public.current_staff_id(p_tenant)])
$$;

-- Snapshot of one service line for a staff member: name, price, duration
-- (staff override → variant → service), buffer.
create or replace function public.item_snapshot(p_tenant uuid, p_service uuid, p_variant uuid, p_staff uuid, p_locale text)
returns table (name text, price_type text, price_minor integer, duration_min integer, buffer_min integer, resource_type text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.services;
  ss public.staff_services;
  v public.service_variants;
begin
  select * into s from public.services where id = p_service and tenant_id = p_tenant and active;
  if s.id is null then
    raise exception 'service not available' using errcode = 'P0002';
  end if;
  select * into ss from public.staff_services where staff_id = p_staff and service_id = p_service;
  if ss.id is null then
    raise exception 'staff does not perform this service' using errcode = 'P0003';
  end if;
  if p_variant is not null then
    select * into v from public.service_variants where id = p_variant and service_id = p_service;
    if v.id is null then raise exception 'variant not found' using errcode = 'P0002'; end if;
  end if;

  return query select
    coalesce(nullif(s.name_i18n ->> p_locale, ''), s.name_i18n ->> 'ka', s.name_i18n ->> 'en', s.name_i18n ->> 'ru')
      || coalesce(' · ' || coalesce(nullif(v.name_i18n ->> p_locale, ''), v.name_i18n ->> 'ka', v.name_i18n ->> 'en'), ''),
    case when v.id is not null then 'fixed' else s.price_type end,
    coalesce(ss.price_minor_override, v.price_minor, s.price_minor),
    coalesce(ss.duration_min_override, v.duration_min, s.duration_min),
    s.buffer_after_min,
    s.resource_type;
end;
$$;

-- Create a booking with one or more items, atomically.
-- p_items: [{service_id, variant_id?, staff_id, resource_id?, starts_at}]
create or replace function public.create_booking(
  p_tenant uuid, p_client uuid, p_items jsonb, p_source text default 'admin',
  p_note text default null, p_status text default 'confirmed', p_locale text default 'ka'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_booking uuid;
  v_staff uuid[];
  r record;
  snap record;
  v_start timestamptz;
  v_end timestamptz;
  v_total integer := 0;
  v_min timestamptz;
  v_max timestamptz;
  v_loc uuid;
  i integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 10 then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  select array_agg((x ->> 'staff_id')::uuid) into v_staff from jsonb_array_elements(p_items) x;
  if not public.may_book_for(p_tenant, v_staff) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'confirmed') or p_source not in ('admin', 'phone', 'walk_in', 'online', 'import') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  if p_client is not null and not exists (select 1 from public.clients where id = p_client and tenant_id = p_tenant and anonymized_at is null) then
    raise exception 'client not found' using errcode = 'P0002';
  end if;
  select id into v_loc from public.locations where tenant_id = p_tenant and is_primary;

  insert into public.bookings (tenant_id, location_id, client_id, starts_at, ends_at, status, source, internal_note, created_by)
  values (p_tenant, v_loc, p_client, now(), now() + interval '1 minute', p_status, p_source, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_booking;

  for r in select (x ->> 'service_id')::uuid service_id, nullif(x ->> 'variant_id', '')::uuid variant_id,
                  (x ->> 'staff_id')::uuid staff_id, nullif(x ->> 'resource_id', '')::uuid resource_id,
                  (x ->> 'starts_at')::timestamptz starts_at
           from jsonb_array_elements(p_items) x
  loop
    if not exists (select 1 from public.staff where id = r.staff_id and tenant_id = p_tenant and active) then
      raise exception 'staff not available' using errcode = 'P0002';
    end if;
    select * into snap from public.item_snapshot(p_tenant, r.service_id, r.variant_id, r.staff_id, p_locale);
    if snap.resource_type is not null and r.resource_id is not null and not exists (
      select 1 from public.resources where id = r.resource_id and tenant_id = p_tenant and type = snap.resource_type and active
    ) then
      raise exception 'resource not suitable' using errcode = 'P0002';
    end if;

    v_start := r.starts_at;
    v_end := v_start + make_interval(mins => snap.duration_min);
    insert into public.booking_items (tenant_id, booking_id, service_id, variant_id, staff_id, resource_id,
      name_snapshot, price_type_snapshot, price_minor_snapshot, duration_min_snapshot, buffer_min_snapshot,
      starts_at, ends_at, blocked_until, sort_order)
    values (p_tenant, v_booking, r.service_id, r.variant_id, r.staff_id, r.resource_id,
      snap.name, snap.price_type, snap.price_minor, snap.duration_min, snap.buffer_min,
      v_start, v_end, v_end + make_interval(mins => snap.buffer_min), i);
    v_total := v_total + snap.price_minor;
    v_min := least(coalesce(v_min, v_start), v_start);
    v_max := greatest(coalesce(v_max, v_end), v_end);
    i := i + 1;
  end loop;

  update public.bookings set starts_at = v_min, ends_at = v_max, total_minor = v_total where id = v_booking;
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, changed_by)
  values (p_tenant, v_booking, null, p_status, auth.uid());
  return v_booking;
end;
$$;

-- Move / resize / reassign items. p_items: [{item_id, staff_id, starts_at, duration_min?}]
create or replace function public.move_booking(p_booking uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  r record;
  it public.booking_items;
  v_old jsonb;
  v_new_staff uuid[];
  v_old_staff uuid[];
  v_dur integer;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if b.status not in ('pending', 'confirmed', 'arrived') then
    raise exception 'booking cannot be moved' using errcode = 'P0001';
  end if;
  select array_agg(staff_id) into v_old_staff from public.booking_items where booking_id = p_booking;
  select array_agg((x ->> 'staff_id')::uuid) into v_new_staff from jsonb_array_elements(p_items) x;
  if not public.may_book_for(b.tenant_id, v_old_staff) or not public.may_book_for(b.tenant_id, v_new_staff) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object('item', id, 'staff', staff_id, 'from', starts_at, 'to', ends_at))
    into v_old from public.booking_items where booking_id = p_booking;

  for r in select (x ->> 'item_id')::uuid item_id, (x ->> 'staff_id')::uuid staff_id,
                  (x ->> 'starts_at')::timestamptz starts_at, nullif(x ->> 'duration_min', '')::integer duration_min
           from jsonb_array_elements(p_items) x
  loop
    select * into it from public.booking_items where id = r.item_id and booking_id = p_booking;
    if it.id is null then raise exception 'item not found' using errcode = 'P0002'; end if;
    if r.staff_id <> it.staff_id and (it.service_id is null or not exists (
      select 1 from public.staff_services where staff_id = r.staff_id and service_id = it.service_id)) then
      raise exception 'staff does not perform this service' using errcode = 'P0003';
    end if;
    v_dur := coalesce(r.duration_min, it.duration_min_snapshot);
    if v_dur not between 5 and 720 then raise exception 'invalid duration' using errcode = '22023'; end if;
    update public.booking_items set
      staff_id = r.staff_id,
      starts_at = r.starts_at,
      ends_at = r.starts_at + make_interval(mins => v_dur),
      blocked_until = r.starts_at + make_interval(mins => v_dur + it.buffer_min_snapshot),
      duration_min_snapshot = v_dur
    where id = it.id;
  end loop;

  update public.bookings set
    starts_at = (select min(starts_at) from public.booking_items where booking_id = p_booking),
    ends_at = (select max(ends_at) from public.booking_items where booking_id = p_booking)
  where id = p_booking;
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, changed_by, reason, meta)
  values (b.tenant_id, p_booking, b.status, b.status, auth.uid(), 'rescheduled',
          jsonb_build_object('before', v_old));
end;
$$;

-- Status change with history. Cancelled / no-show free the slot; undo back to
-- confirmed takes it again (fails if someone else took it meanwhile).
create or replace function public.set_booking_status(p_booking uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v_staff uuid[];
  v_ok boolean;
  v_free constant text[] := array['cancelled_by_client', 'cancelled_by_business', 'no_show'];
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select array_agg(staff_id) into v_staff from public.booking_items where booking_id = p_booking;
  if not public.may_book_for(b.tenant_id, v_staff) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_ok := case b.status
    when 'pending'     then p_status in ('confirmed', 'cancelled_by_client', 'cancelled_by_business')
    when 'confirmed'   then p_status in ('arrived', 'in_progress', 'completed', 'no_show', 'cancelled_by_client', 'cancelled_by_business')
    when 'arrived'     then p_status in ('in_progress', 'completed', 'no_show', 'cancelled_by_client', 'cancelled_by_business', 'confirmed')
    when 'in_progress' then p_status in ('completed', 'arrived')
    when 'completed'   then p_status in ('in_progress')
    else p_status = 'confirmed'  -- undo a cancellation or no-show
  end;
  if not v_ok then raise exception 'invalid transition' using errcode = 'P0001'; end if;

  update public.booking_items set active = not (p_status = any (v_free)) where booking_id = p_booking;
  update public.bookings set status = p_status,
    cancel_reason = case when p_status like 'cancelled%' then nullif(btrim(p_reason), '') else null end
  where id = p_booking;

  if b.client_id is not null and p_status = 'no_show' then
    update public.clients set no_show_count = no_show_count + 1 where id = b.client_id;
  elsif b.client_id is not null and b.status = 'no_show' then
    update public.clients set no_show_count = greatest(no_show_count - 1, 0) where id = b.client_id;
  end if;

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, changed_by, reason)
  values (b.tenant_id, p_booking, b.status, p_status, auth.uid(), nullif(btrim(p_reason), ''));
end;
$$;

create or replace function public.set_booking_note(p_booking uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v_staff uuid[];
begin
  select * into b from public.bookings where id = p_booking;
  select array_agg(staff_id) into v_staff from public.booking_items where booking_id = p_booking;
  if b.id is null or not public.may_book_for(b.tenant_id, v_staff) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.bookings set internal_note = nullif(btrim(p_note), '') where id = p_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dental notes: owner, or staff whose linked profile is a doctor. Every read
-- is written to the audit log.
-- ---------------------------------------------------------------------------

create or replace function public.can_use_dental_notes(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tenants t where t.id = p_tenant and t.type = 'dental')
    and (public.has_role(p_tenant, array['owner'])
         or exists (select 1 from public.staff s
                    where s.id = public.current_staff_id(p_tenant) and s.position_type = 'doctor'))
$$;

create or replace function public.read_dental_notes(p_client uuid)
returns table (id uuid, booking_id uuid, author_name text, body text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.clients where clients.id = p_client;
  if v_tenant is null or not public.can_use_dental_notes(v_tenant) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform public.write_audit(v_tenant, 'dental_notes.read', 'client', p_client::text);
  return query
    select n.id, n.booking_id, coalesce(p.full_name, ''), n.body, n.created_at
    from public.dental_notes n left join public.profiles p on p.id = n.author_id
    where n.client_id = p_client
    order by n.created_at desc;
end;
$$;

create or replace function public.add_dental_note(p_client uuid, p_booking uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
  v_id uuid;
begin
  select tenant_id into v_tenant from public.clients where id = p_client;
  if v_tenant is null or not public.can_use_dental_notes(v_tenant) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.dental_notes (tenant_id, client_id, booking_id, author_id, body)
  values (v_tenant, p_client, p_booking, auth.uid(), btrim(p_body))
  returning id into v_id;
  perform public.write_audit(v_tenant, 'dental_notes.added', 'client', p_client::text, jsonb_build_object('note', v_id));
  return v_id;
end;
$$;

-- client export now includes bookings (still never dental notes: those are
-- handed out by the clinic separately, under medical-records rules)
create or replace function public.export_client(p_client uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
  v_result jsonb;
begin
  select tenant_id into v_tenant from public.clients where id = p_client;
  if v_tenant is null or not public.has_role(v_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'business', (select jsonb_build_object('name', t.name) from public.tenants t where t.id = v_tenant),
    'client', to_jsonb(c) - 'tenant_id' - 'created_by',
    'consents', coalesce((select jsonb_agg(to_jsonb(cc) - 'tenant_id' - 'recorded_by' order by cc.at)
                          from public.client_consents cc where cc.client_id = c.id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
                            'starts_at', b.starts_at, 'status', b.status, 'total_minor', b.total_minor,
                            'services', (select jsonb_agg(i.name_snapshot order by i.sort_order) from public.booking_items i where i.booking_id = b.id))
                          order by b.starts_at)
                          from public.bookings b where b.client_id = c.id), '[]'::jsonb)
  ) into v_result
  from public.clients c where c.id = p_client;
  perform public.write_audit(v_tenant, 'client.exported', 'client', p_client::text);
  return v_result;
end;
$$;

-- merge also moves bookings and dental notes to the kept card
create or replace function public.merge_clients(p_keep uuid, p_remove uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  k public.clients;
  r public.clients;
begin
  select * into k from public.clients where id = p_keep for update;
  select * into r from public.clients where id = p_remove for update;
  if k.id is null or r.id is null or k.id = r.id or k.tenant_id <> r.tenant_id
     or k.anonymized_at is not null or r.anonymized_at is not null
     or not public.has_role(k.tenant_id, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.clients set phone_e164 = null where id = r.id;
  update public.clients set
    last_name = coalesce(k.last_name, r.last_name),
    phone_e164 = coalesce(k.phone_e164, r.phone_e164),
    email = coalesce(k.email, r.email),
    birthday = coalesce(k.birthday, r.birthday),
    gender = coalesce(k.gender, r.gender),
    tags = (select coalesce(array_agg(distinct x), '{}') from unnest(k.tags || r.tags) x),
    notes = nullif(concat_ws(E'\n\n', k.notes, r.notes), ''),
    important_note = nullif(concat_ws(' · ', k.important_note, r.important_note), ''),
    preferred_staff_id = coalesce(k.preferred_staff_id, r.preferred_staff_id),
    no_show_count = k.no_show_count + r.no_show_count,
    blocked_online = k.blocked_online or r.blocked_online
  where id = k.id;

  update public.client_consents set client_id = k.id where client_id = r.id;
  update public.bookings set client_id = k.id where client_id = r.id;
  update public.dental_notes set client_id = k.id where client_id = r.id;
  delete from public.clients where id = r.id;
  perform public.write_audit(k.tenant_id, 'client.merged', 'client', k.id::text, jsonb_build_object('removed', r.id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.can_see_booking(uuid, uuid), public.staff_has_client(uuid, uuid),
  public.may_book_for(uuid, uuid[]), public.item_snapshot(uuid, uuid, uuid, uuid, text),
  public.create_booking(uuid, uuid, jsonb, text, text, text, text), public.move_booking(uuid, jsonb),
  public.set_booking_status(uuid, text, text), public.set_booking_note(uuid, text),
  public.can_use_dental_notes(uuid), public.read_dental_notes(uuid), public.add_dental_note(uuid, uuid, text)
  from public, anon;

grant execute on function public.can_see_booking(uuid, uuid), public.staff_has_client(uuid, uuid),
  public.may_book_for(uuid, uuid[]), public.create_booking(uuid, uuid, jsonb, text, text, text, text),
  public.move_booking(uuid, jsonb), public.set_booking_status(uuid, text, text), public.set_booking_note(uuid, text),
  public.can_use_dental_notes(uuid), public.read_dental_notes(uuid), public.add_dental_note(uuid, uuid, text)
  to authenticated;
-- item_snapshot stays internal (called by create_booking only)
revoke execute on function public.item_snapshot(uuid, uuid, uuid, uuid, text) from authenticated;
