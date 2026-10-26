-- "Payment due" is a warning, not a stop: online booking and reminders keep
-- working; only suspended/cancelled businesses stop (SPEC 4.13).
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
  if not exists (select 1 from public.tenants where id = p_tenant and status in ('trial', 'active', 'past_due')) then
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

create or replace function public.sms_due_reminders()
returns table (
  tenant_id uuid, booking_id uuid, client_id uuid, offset_min integer, starts_at timestamptz,
  phone text, first_name text, business text, timezone text, locale text, address text, business_phone text,
  quiet_start time, quiet_end time, services text, staff text
) language sql stable security definer set search_path = '' as $$
  select b.tenant_id, b.id, c.id, o.offset_min, b.starts_at,
         c.phone_e164, c.first_name, t.name, t.timezone, t.locale_default, l.address, coalesce(s.phone, l.phone),
         s.quiet_start, s.quiet_end,
         (select string_agg(i.name_snapshot, ', ' order by i.sort_order) from public.booking_items i where i.booking_id = b.id),
         (select string_agg(distinct st.display_name, ', ') from public.booking_items i
            join public.staff st on st.id = i.staff_id where i.booking_id = b.id)
  from public.bookings b
  join public.tenants t on t.id = b.tenant_id and t.status in ('trial', 'active', 'past_due')
  join public.tenant_settings s on s.tenant_id = b.tenant_id
  join public.clients c on c.id = b.client_id and c.phone_e164 is not null and c.anonymized_at is null
  left join public.locations l on l.tenant_id = b.tenant_id and l.is_primary
  cross join lateral (
    select 1440 as offset_min where s.reminder_24h
    union all select 120 where s.reminder_2h
  ) o
  where b.status in ('pending', 'confirmed')
    and b.starts_at > now()
    and b.starts_at - make_interval(mins => o.offset_min) <= now()
    and b.starts_at - make_interval(mins => o.offset_min) > now() - interval '6 hours'  -- never very late
    and b.created_at < b.starts_at - make_interval(mins => o.offset_min)  -- booked after the offset: skip
    and not exists (
      select 1 from public.sms_messages m
      where m.tenant_id = b.tenant_id
        and m.idempotency_key = 'reminder:' || o.offset_min || ':' || b.id || ':' || floor(extract(epoch from b.starts_at))::bigint
    );
$$;
