-- Phase 3b: recurring bookings, waitlist, checkout (payments + extra charges),
-- booking import log. Writes go through RPCs; RLS decides who reads.

alter table public.tenant_settings
  add column admins_see_revenue boolean not null default true;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.recurrences (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  every_weeks  integer not null check (every_weeks between 1 and 12),
  occurrences  integer not null check (occurrences between 2 and 52),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (id, tenant_id)
);

alter table public.bookings
  add constraint bookings_recurrence_fk foreign key (recurrence_id, tenant_id)
  references public.recurrences (id, tenant_id) on delete set null (recurrence_id);
create index bookings_recurrence on public.bookings (recurrence_id) where recurrence_id is not null;

create table public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  client_id       uuid not null,
  service_id      uuid not null,
  staff_id        uuid,
  date_from       date not null,
  date_to         date not null check (date_to >= date_from),
  time_from       time,
  time_to         time,
  note            text check (char_length(note) <= 500),
  status          text not null default 'waiting' check (status in ('waiting', 'booked', 'cancelled')),
  booking_id      uuid,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (service_id, tenant_id) references public.services (id, tenant_id) on delete cascade,
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete set null (staff_id),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete set null (booking_id),
  check (time_to is null or time_from is null or time_to > time_from)
);
create index waitlist_open on public.waitlist (tenant_id, status, date_from, date_to);

-- extra lines added at checkout (a product, an extra service)
create table public.booking_charges (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  booking_id   uuid not null,
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  price_minor  integer not null check (price_minor between 0 and 100000000),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);
create index booking_charges_booking on public.booking_charges (booking_id);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  booking_id    uuid not null,
  amount_minor  integer not null check (amount_minor >= 0),
  tip_minor     integer not null default 0 check (tip_minor >= 0),
  tip_staff_id  uuid,
  method        text not null check (method in ('cash', 'card', 'transfer', 'gift_card', 'online')),
  status        text not null default 'paid' check (status in ('paid', 'refunded', 'void')),
  provider      text,
  provider_ref  text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade,
  foreign key (tip_staff_id, tenant_id) references public.staff (id, tenant_id) on delete set null (tip_staff_id),
  check (amount_minor > 0 or tip_minor > 0)
);
create index payments_tenant_created on public.payments (tenant_id, created_at);
create index payments_booking on public.payments (booking_id);

create table public.booking_imports (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  file_name      text check (char_length(file_name) <= 200),
  rows_total     integer not null,
  rows_imported  integer not null,
  rows_skipped   integer not null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create trigger waitlist_updated_at before update on public.waitlist for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['recurrences', 'waitlist', 'booking_charges', 'payments', 'booking_imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.prevent_tenant_change()', t || '_tenant_fixed', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read rules
-- ---------------------------------------------------------------------------

-- Money: owner always; admins unless the owner hides revenue from them; staff
-- only for bookings they work on (their own revenue).
create or replace function public.can_see_money(p_tenant uuid, p_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_tenant, array['owner'])
    or (public.has_role(p_tenant, array['admin'])
        and coalesce((select s.admins_see_revenue from public.tenant_settings s where s.tenant_id = p_tenant), true))
    or (public.has_role(p_tenant, array['staff'])
        and exists (select 1 from public.booking_items i
                    where i.booking_id = p_booking and i.staff_id = public.current_staff_id(p_tenant)))
$$;

create policy recurrences_select on public.recurrences for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));
create policy waitlist_select on public.waitlist for select to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin'])
         or (public.has_role(tenant_id, array['staff']) and staff_id = public.current_staff_id(tenant_id)));
create policy booking_charges_select on public.booking_charges for select to authenticated
  using (public.can_see_booking(tenant_id, booking_id));
create policy payments_select on public.payments for select to authenticated
  using (public.can_see_money(tenant_id, booking_id));
create policy booking_imports_select on public.booking_imports for select to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- Recurring bookings: all occurrences at once, or none.
-- p_occurrences: [[{service_id, variant_id?, staff_id, resource_id?, starts_at}], ...]
-- ---------------------------------------------------------------------------

create or replace function public.create_recurring_booking(
  p_tenant uuid, p_client uuid, p_occurrences jsonb, p_every_weeks integer,
  p_source text default 'admin', p_note text default null, p_locale text default 'ka'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_rec uuid;
  v_booking uuid;
  occ jsonb;
begin
  if jsonb_typeof(p_occurrences) <> 'array' or jsonb_array_length(p_occurrences) not between 2 and 52 then
    raise exception 'invalid occurrences' using errcode = '22023';
  end if;
  insert into public.recurrences (tenant_id, every_weeks, occurrences, created_by)
  values (p_tenant, p_every_weeks, jsonb_array_length(p_occurrences), auth.uid())
  returning id into v_rec;

  for occ in select * from jsonb_array_elements(p_occurrences) loop
    -- create_booking checks permissions, services, staff and overlaps
    v_booking := public.create_booking(p_tenant, p_client, occ, p_source, p_note, 'confirmed', p_locale);
    update public.bookings set recurrence_id = v_rec where id = v_booking;
  end loop;
  return v_rec;
end;
$$;

-- Cancel this booking and every later one of the same series.
create or replace function public.cancel_following(p_booking uuid, p_status text, p_reason text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  r record;
  n integer := 0;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_status not in ('cancelled_by_client', 'cancelled_by_business') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  for r in select id from public.bookings
           where (id = p_booking or (b.recurrence_id is not null and recurrence_id = b.recurrence_id and starts_at >= b.starts_at))
             and status in ('pending', 'confirmed')
           order by starts_at
  loop
    perform public.set_booking_status(r.id, p_status, p_reason);  -- checks permissions per booking
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Waitlist
-- ---------------------------------------------------------------------------

create or replace function public.add_to_waitlist(
  p_tenant uuid, p_client uuid, p_service uuid, p_staff uuid,
  p_date_from date, p_date_to date, p_time_from time, p_time_to time, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not (public.has_role(p_tenant, array['owner', 'admin'])
          or (p_staff is not null and public.may_book_for(p_tenant, array[p_staff]))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.waitlist (tenant_id, client_id, service_id, staff_id, date_from, date_to, time_from, time_to, note, created_by)
  values (p_tenant, p_client, p_service, p_staff, p_date_from, p_date_to, p_time_from, p_time_to, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_waitlist_status(p_entry uuid, p_status text, p_booking uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  w public.waitlist;
begin
  select * into w from public.waitlist where id = p_entry;
  if w.id is null or not (public.has_role(w.tenant_id, array['owner', 'admin'])
                          or (w.staff_id is not null and public.may_book_for(w.tenant_id, array[w.staff_id]))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('waiting', 'booked', 'cancelled') then raise exception 'invalid' using errcode = '22023'; end if;
  if p_booking is not null and not exists (select 1 from public.bookings where id = p_booking and tenant_id = w.tenant_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  update public.waitlist set status = p_status, booking_id = coalesce(p_booking, booking_id) where id = p_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout: extra charges, discount, one or more payments (+ tip), complete.
-- p_charges: [{name, price_minor}]   p_payments: [{method, amount_minor}]
-- ---------------------------------------------------------------------------

create or replace function public.checkout_booking(
  p_booking uuid, p_charges jsonb, p_discount_minor integer, p_payments jsonb,
  p_tip_minor integer default 0, p_tip_staff uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v_staff uuid[];
  v_items integer;
  v_charges integer;
  v_total integer;
  v_paid integer;
  p jsonb;
  v_first boolean := true;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select array_agg(staff_id) into v_staff from public.booking_items where booking_id = p_booking;
  if not public.may_book_for(b.tenant_id, v_staff) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.status in ('cancelled_by_client', 'cancelled_by_business', 'no_show', 'pending') then
    raise exception 'booking cannot be paid' using errcode = 'P0001';
  end if;
  if p_tip_staff is not null and not exists (select 1 from public.staff where id = p_tip_staff and tenant_id = b.tenant_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  insert into public.booking_charges (tenant_id, booking_id, name, price_minor, created_by)
  select b.tenant_id, p_booking, btrim(c ->> 'name'), (c ->> 'price_minor')::integer, auth.uid()
  from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb)) c;

  select coalesce(sum(price_minor_snapshot), 0) into v_items from public.booking_items where booking_id = p_booking;
  select coalesce(sum(price_minor), 0) into v_charges from public.booking_charges where booking_id = p_booking;
  if p_discount_minor < 0 or p_discount_minor > v_items + v_charges then
    raise exception 'invalid discount' using errcode = '22023';
  end if;
  v_total := v_items + v_charges - p_discount_minor;

  for p in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    insert into public.payments (tenant_id, booking_id, amount_minor, tip_minor, tip_staff_id, method, created_by)
    values (b.tenant_id, p_booking, (p ->> 'amount_minor')::integer,
            case when v_first then coalesce(p_tip_minor, 0) else 0 end,
            case when v_first and coalesce(p_tip_minor, 0) > 0 then coalesce(p_tip_staff, v_staff[1]) end,
            p ->> 'method', auth.uid());
    v_first := false;
  end loop;

  select coalesce(sum(amount_minor), 0) into v_paid from public.payments where booking_id = p_booking and status = 'paid';
  update public.bookings set discount_minor = p_discount_minor, total_minor = v_total, paid_minor = v_paid where id = p_booking;

  if b.status in ('confirmed', 'arrived', 'in_progress') and v_paid >= v_total then
    perform public.set_booking_status(p_booking, 'completed', null);
  end if;
  perform public.write_audit(b.tenant_id, 'booking.paid', 'booking', p_booking::text,
    jsonb_build_object('total', v_total, 'paid', v_paid));
end;
$$;

-- ---------------------------------------------------------------------------
-- Import existing bookings. Rows were validated and matched in the app; this
-- creates clients by phone and inserts bookings directly (imported history may
-- use services/staff that are no longer active). Overlaps are skipped, not fatal.
-- p_rows: [{line, first_name, last_name, phone_e164, service_id, staff_id,
--           starts_at, duration_min, price_minor, name, status}]
-- ---------------------------------------------------------------------------

create or replace function public.import_bookings(p_tenant uuid, p_rows jsonb, p_file_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  v_client uuid;
  v_booking uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_imported integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_status text;
begin
  if not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'invalid import' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if not exists (select 1 from public.staff where id = (r ->> 'staff_id')::uuid and tenant_id = p_tenant)
         or not exists (select 1 from public.services where id = (r ->> 'service_id')::uuid and tenant_id = p_tenant) then
        raise exception 'unknown staff or service' using errcode = 'P0002';
      end if;

      v_client := null;
      if nullif(r ->> 'phone_e164', '') is not null then
        select id into v_client from public.clients where tenant_id = p_tenant and phone_e164 = r ->> 'phone_e164';
      end if;
      if v_client is null and nullif(btrim(r ->> 'first_name'), '') is not null then
        insert into public.clients (tenant_id, first_name, last_name, phone_e164, source, created_by)
        values (p_tenant, btrim(r ->> 'first_name'), nullif(btrim(r ->> 'last_name'), ''),
                nullif(r ->> 'phone_e164', ''), 'import', auth.uid())
        returning id into v_client;
      end if;

      v_start := (r ->> 'starts_at')::timestamptz;
      v_end := v_start + make_interval(mins => (r ->> 'duration_min')::integer);
      v_status := case when r ->> 'status' in ('confirmed', 'completed', 'no_show', 'cancelled_by_client', 'cancelled_by_business')
                       then r ->> 'status' else (case when v_start < now() then 'completed' else 'confirmed' end) end;

      insert into public.bookings (tenant_id, client_id, starts_at, ends_at, status, source, total_minor, created_by,
                                   location_id)
      values (p_tenant, v_client, v_start, v_end, v_status, 'import', (r ->> 'price_minor')::integer, auth.uid(),
              (select id from public.locations where tenant_id = p_tenant and is_primary))
      returning id into v_booking;

      insert into public.booking_items (tenant_id, booking_id, service_id, staff_id, name_snapshot, price_type_snapshot,
        price_minor_snapshot, duration_min_snapshot, buffer_min_snapshot, starts_at, ends_at, blocked_until, active)
      values (p_tenant, v_booking, (r ->> 'service_id')::uuid, (r ->> 'staff_id')::uuid, r ->> 'name', 'fixed',
        (r ->> 'price_minor')::integer, (r ->> 'duration_min')::integer, 0, v_start, v_end, v_end,
        v_status not in ('no_show', 'cancelled_by_client', 'cancelled_by_business'));

      insert into public.booking_status_history (tenant_id, booking_id, to_status, changed_by, reason)
      values (p_tenant, v_booking, v_status, auth.uid(), 'imported');
      v_imported := v_imported + 1;
    exception
      when exclusion_violation then
        v_skipped := v_skipped || jsonb_build_object('line', r -> 'line', 'reason', 'overlap');
      when others then
        v_skipped := v_skipped || jsonb_build_object('line', r -> 'line', 'reason', 'invalid');
    end;
  end loop;

  insert into public.booking_imports (tenant_id, file_name, rows_total, rows_imported, rows_skipped, created_by)
  values (p_tenant, left(p_file_name, 200), jsonb_array_length(p_rows), v_imported, jsonb_array_length(v_skipped), auth.uid());
  perform public.write_audit(p_tenant, 'bookings.imported', 'booking', null,
    jsonb_build_object('imported', v_imported, 'skipped', jsonb_array_length(v_skipped)));
  return jsonb_build_object('imported', v_imported, 'skipped', v_skipped);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.can_see_money(uuid, uuid), public.create_recurring_booking(uuid, uuid, jsonb, integer, text, text, text),
  public.cancel_following(uuid, text, text), public.add_to_waitlist(uuid, uuid, uuid, uuid, date, date, time, time, text),
  public.set_waitlist_status(uuid, text, uuid), public.checkout_booking(uuid, jsonb, integer, jsonb, integer, uuid),
  public.import_bookings(uuid, jsonb, text)
  from public, anon;
grant execute on function public.can_see_money(uuid, uuid), public.create_recurring_booking(uuid, uuid, jsonb, integer, text, text, text),
  public.cancel_following(uuid, text, text), public.add_to_waitlist(uuid, uuid, uuid, uuid, date, date, time, time, text),
  public.set_waitlist_status(uuid, text, uuid), public.checkout_booking(uuid, jsonb, integer, jsonb, integer, uuid),
  public.import_bookings(uuid, jsonb, text)
  to authenticated;
