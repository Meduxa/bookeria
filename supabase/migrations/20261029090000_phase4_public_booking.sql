-- Phase 4: public online booking page (decision 007).
-- Visitors are never signed in and their browsers get nothing new: every table
-- here has forced RLS with NO policies, and every function is executable only
-- by service_role, i.e. by Bookeria's own server code after it has checked
-- availability, the SMS code and the rate limits.

-- ---------------------------------------------------------------------------
-- Settings and booking fields
-- ---------------------------------------------------------------------------
alter table public.tenant_settings
  add column online_otp_required boolean not null default true;  -- SMS code before an online booking

-- ---------------------------------------------------------------------------
-- SMS codes: only an HMAC of the code is stored (the pepper lives on the server)
-- ---------------------------------------------------------------------------
create table public.otp_codes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  phone_e164   text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  code_hash    text not null,
  attempts     integer not null default 0,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index otp_codes_lookup on public.otp_codes (tenant_id, phone_e164, created_at desc);

-- One-off proof that a phone was verified, handed back to the browser as an
-- opaque token and spent when the booking is made (hash stored).
create table public.otp_passes (
  token_hash   text primary key,
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  phone_e164   text not null,
  expires_at   timestamptz not null,
  used_at      timestamptz
);

-- ---------------------------------------------------------------------------
-- Rate limits: sliding window per key (e.g. "otp:phone:+995…", "book:ip:…")
-- ---------------------------------------------------------------------------
create table public.rate_events (
  key  text not null,
  at   timestamptz not null default now()
);
create index rate_events_key_at on public.rate_events (key, at);

-- ---------------------------------------------------------------------------
-- Manage-booking links: the token goes to the client, only its hash is stored
-- ---------------------------------------------------------------------------
create table public.booking_manage_tokens (
  token_hash   text primary key,
  tenant_id    uuid not null,
  booking_id   uuid not null,
  created_at   timestamptz not null default now(),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);
create index on public.booking_manage_tokens (booking_id);
create index on public.booking_manage_tokens (tenant_id);

do $$
declare t text;
begin
  foreach t in array array['otp_codes', 'otp_passes', 'rate_events', 'booking_manage_tokens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Functions (service_role only)
-- ---------------------------------------------------------------------------

-- true = allowed (and counted); false = over the limit
create or replace function public.rate_hit(p_key text, p_limit integer, p_window_sec integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  delete from public.rate_events where key = p_key and at < now() - make_interval(secs => p_window_sec);
  select count(*) into v_count from public.rate_events where key = p_key;
  if v_count >= p_limit then return false; end if;
  insert into public.rate_events (key) values (p_key);
  return true;
end;
$$;

create or replace function public.otp_issue(p_tenant uuid, p_phone text, p_code_hash text, p_ttl_sec integer default 300)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- a new code replaces older ones
  update public.otp_codes set consumed_at = now()
  where tenant_id = p_tenant and phone_e164 = p_phone and consumed_at is null;
  insert into public.otp_codes (tenant_id, phone_e164, code_hash, expires_at)
  values (p_tenant, p_phone, p_code_hash, now() + make_interval(secs => p_ttl_sec));
  delete from public.otp_codes where created_at < now() - interval '1 day';
end;
$$;

-- 'ok' | 'wrong' | 'expired' (no live code, or too many attempts)
create or replace function public.otp_verify(p_tenant uuid, p_phone text, p_code_hash text, p_pass_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare c public.otp_codes;
begin
  select * into c from public.otp_codes
  where tenant_id = p_tenant and phone_e164 = p_phone and consumed_at is null and expires_at > now()
  order by created_at desc limit 1 for update;
  if c.id is null or c.attempts >= 5 then return 'expired'; end if;
  if c.code_hash <> p_code_hash then
    update public.otp_codes set attempts = attempts + 1 where id = c.id;
    return 'wrong';
  end if;
  update public.otp_codes set consumed_at = now() where id = c.id;
  insert into public.otp_passes (token_hash, tenant_id, phone_e164, expires_at)
  values (p_pass_hash, p_tenant, p_phone, now() + interval '30 minutes');
  delete from public.otp_passes where expires_at < now() - interval '1 day';
  return 'ok';
end;
$$;

-- Creates the client (or finds them by phone), the booking and its items, the
-- consents that were ticked, and the manage token. The server has already
-- checked availability with the engine; overlaps are refused here by the
-- exclusion constraints (23P01), whatever the server thought.
create or replace function public.public_create_booking(
  p_tenant uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_comment text,
  p_items jsonb,              -- [{service_id, variant_id?, staff_id, resource_id?, starts_at}]
  p_marketing_sms boolean,
  p_marketing_email boolean,
  p_locale text,
  p_manage_token_hash text,
  p_otp_pass_hash text        -- null only when the business does not require a code
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.tenant_settings;
  v_client uuid;
  v_blocked boolean;
  v_booking uuid;
  v_status text;
  v_loc uuid;
  r record;
  snap record;
  v_start timestamptz;
  v_end timestamptz;
  v_total integer := 0;
  v_min timestamptz;
  v_max timestamptz;
  i integer := 0;
begin
  if not exists (select 1 from public.tenants where id = p_tenant and status in ('trial', 'active')) then
    raise exception 'business not available' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 5 then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' or nullif(btrim(p_first_name), '') is null
     or char_length(p_first_name) > 80 or char_length(coalesce(p_last_name, '')) > 80
     or char_length(coalesce(p_email, '')) > 200 then
    raise exception 'invalid client' using errcode = '22023';
  end if;
  select * into v_settings from public.tenant_settings where tenant_id = p_tenant;

  -- phone proof: required unless the business switched it off
  if v_settings.online_otp_required or p_otp_pass_hash is not null then
    update public.otp_passes set used_at = now()
    where token_hash = p_otp_pass_hash and tenant_id = p_tenant and phone_e164 = p_phone
      and used_at is null and expires_at > now();
    if not found then raise exception 'phone not verified' using errcode = '28000'; end if;
  end if;

  select id, blocked_online into v_client, v_blocked from public.clients
  where tenant_id = p_tenant and phone_e164 = p_phone and anonymized_at is null
  order by created_at limit 1;
  if v_blocked then raise exception 'online booking blocked' using errcode = 'P0004'; end if;
  if v_client is null then
    insert into public.clients (tenant_id, first_name, last_name, phone_e164, email, source)
    values (p_tenant, btrim(p_first_name), nullif(btrim(p_last_name), ''), p_phone,
            nullif(lower(btrim(p_email)), ''), 'online')
    returning id into v_client;
  else
    update public.clients set email = coalesce(email, nullif(lower(btrim(p_email)), ''))
    where id = v_client;
  end if;

  -- a ticked box is consent; an unticked one changes nothing
  if p_marketing_sms then
    insert into public.client_consents (tenant_id, client_id, channel, granted, source)
    values (p_tenant, v_client, 'sms', true, 'booking_page');
  end if;
  if p_marketing_email and nullif(btrim(p_email), '') is not null then
    insert into public.client_consents (tenant_id, client_id, channel, granted, source)
    values (p_tenant, v_client, 'email', true, 'booking_page');
  end if;

  v_status := case when v_settings.online_requires_approval then 'pending' else 'confirmed' end;
  select id into v_loc from public.locations where tenant_id = p_tenant and is_primary;
  insert into public.bookings (tenant_id, location_id, client_id, starts_at, ends_at, status, source, client_comment)
  values (p_tenant, v_loc, v_client, now(), now() + interval '1 minute', v_status, 'online',
          nullif(btrim(left(p_comment, 500)), ''))
  returning id into v_booking;

  for r in select (x ->> 'service_id')::uuid service_id, nullif(x ->> 'variant_id', '')::uuid variant_id,
                  (x ->> 'staff_id')::uuid staff_id, nullif(x ->> 'resource_id', '')::uuid resource_id,
                  (x ->> 'starts_at')::timestamptz starts_at
           from jsonb_array_elements(p_items) x
  loop
    if not exists (select 1 from public.services
                   where id = r.service_id and tenant_id = p_tenant and active and bookable_online)
       or not exists (select 1 from public.staff
                      where id = r.staff_id and tenant_id = p_tenant and active and bookable_online)
       or not exists (select 1 from public.staff_services where staff_id = r.staff_id and service_id = r.service_id) then
      raise exception 'not bookable online' using errcode = 'P0003';
    end if;
    if r.starts_at < now() then raise exception 'in the past' using errcode = '22023'; end if;
    select * into snap from public.item_snapshot(p_tenant, r.service_id, r.variant_id, r.staff_id, p_locale);
    if snap.resource_type is not null and (r.resource_id is null or not exists (
      select 1 from public.resources where id = r.resource_id and tenant_id = p_tenant and type = snap.resource_type and active
    )) then
      raise exception 'resource not suitable' using errcode = 'P0003';
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
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason)
  values (p_tenant, v_booking, null, v_status, 'online');
  insert into public.booking_manage_tokens (token_hash, tenant_id, booking_id)
  values (p_manage_token_hash, p_tenant, v_booking);
  return jsonb_build_object('booking_id', v_booking, 'status', v_status, 'client_id', v_client);
end;
$$;

-- What the manage page shows (no other client data).
create or replace function public.public_manage_view(p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'booking_id', b.id, 'tenant_id', b.tenant_id, 'slug', t.slug, 'business', t.name, 'timezone', t.timezone,
    'status', b.status, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'total_minor', b.total_minor,
    'first_name', c.first_name, 'cancel_window_min', s.cancel_window_min, 'phone', coalesce(s.phone, l.phone),
    'address', l.address,
    'items', (select jsonb_agg(jsonb_build_object('service_id', i.service_id, 'variant_id', i.variant_id,
                'staff_id', i.staff_id, 'staff', st.display_name, 'name', i.name_snapshot,
                'starts_at', i.starts_at, 'duration_min', i.duration_min_snapshot) order by i.sort_order)
              from public.booking_items i join public.staff st on st.id = i.staff_id where i.booking_id = b.id)
  )
  from public.booking_manage_tokens m
  join public.bookings b on b.id = m.booking_id
  join public.tenants t on t.id = b.tenant_id
  join public.tenant_settings s on s.tenant_id = b.tenant_id
  left join public.clients c on c.id = b.client_id
  left join public.locations l on l.tenant_id = b.tenant_id and l.is_primary
  where m.token_hash = p_token_hash;
$$;

-- Client cancels: only while the booking is active and before the cancellation window.
create or replace function public.public_cancel_booking(p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings; v_window integer;
begin
  select bk.* into b from public.booking_manage_tokens m join public.bookings bk on bk.id = m.booking_id
  where m.token_hash = p_token_hash for update of bk;
  if b.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select cancel_window_min into v_window from public.tenant_settings where tenant_id = b.tenant_id;
  if b.status not in ('pending', 'confirmed') then raise exception 'not active' using errcode = 'P0001'; end if;
  if now() > b.starts_at - make_interval(mins => v_window) then
    raise exception 'too late' using errcode = 'P0005';
  end if;
  update public.bookings set status = 'cancelled_by_client', cancel_reason = 'online' where id = b.id;
  update public.booking_items set active = false where booking_id = b.id;
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason)
  values (b.tenant_id, b.id, b.status, 'cancelled_by_client', 'manage link');
end;
$$;

-- Client moves the whole visit by the same offset, same people. The server
-- checked the new time with the engine; overlaps still fail with 23P01.
create or replace function public.public_move_booking(p_token_hash text, p_starts_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings; v_window integer; v_shift interval;
begin
  select bk.* into b from public.booking_manage_tokens m join public.bookings bk on bk.id = m.booking_id
  where m.token_hash = p_token_hash for update of bk;
  if b.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select cancel_window_min into v_window from public.tenant_settings where tenant_id = b.tenant_id;
  if b.status not in ('pending', 'confirmed') then raise exception 'not active' using errcode = 'P0001'; end if;
  if now() > b.starts_at - make_interval(mins => v_window) then
    raise exception 'too late' using errcode = 'P0005';
  end if;
  if p_starts_at < now() then raise exception 'in the past' using errcode = '22023'; end if;
  v_shift := p_starts_at - b.starts_at;
  update public.booking_items set starts_at = starts_at + v_shift, ends_at = ends_at + v_shift,
    blocked_until = blocked_until + v_shift
  where booking_id = b.id;
  update public.bookings set starts_at = starts_at + v_shift, ends_at = ends_at + v_shift where id = b.id;
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason, meta)
  values (b.tenant_id, b.id, b.status, b.status, 'rescheduled online', jsonb_build_object('from', b.starts_at));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.rate_hit(text, integer, integer)',
    'public.otp_issue(uuid, text, text, integer)',
    'public.otp_verify(uuid, text, text, text)',
    'public.public_create_booking(uuid, text, text, text, text, text, jsonb, boolean, boolean, text, text, text)',
    'public.public_manage_view(text)',
    'public.public_cancel_booking(text)',
    'public.public_move_booking(text, timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
