-- The reminder key uses the start time in whole seconds. ::bigint rounds, while
-- the server rounds down: for times with a fraction over .5 the keys differed and
-- the reminder looked unsent every minute. Round down here too.
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
  join public.tenants t on t.id = b.tenant_id and t.status in ('trial', 'active')
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
