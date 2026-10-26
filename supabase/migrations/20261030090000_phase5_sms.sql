-- Phase 5: SMS — one queue and log for every message, credits ledger,
-- templates per business, reminder and quiet-hour settings.
-- Members only READ (owners/admins); every write goes through functions that
-- only the server key may call (same rule as decision 007).

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
alter table public.tenant_settings
  add column sms_sender_name    text check (sms_sender_name ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{1,10}$'),
  add column sms_sender_status  text not null default 'none'
                                check (sms_sender_status in ('none', 'pending', 'approved', 'rejected')),
  add column reminder_24h       boolean not null default false,
  add column reminder_2h        boolean not null default true,
  add column quiet_start        time not null default '22:00',
  add column quiet_end          time not null default '09:00',
  add column sms_on_confirm     boolean not null default true,
  add column sms_on_reschedule  boolean not null default true,
  add column sms_on_cancel      boolean not null default true,
  add column sms_low_balance    integer not null default 10 check (sms_low_balance between 0 and 10000);

-- A new sender name always waits for the provider's approval; members cannot
-- approve their own name (only the server key can change the status).
create or replace function public.sms_sender_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sms_sender_name is distinct from old.sms_sender_name then
    new.sms_sender_status := case when new.sms_sender_name is null then 'none' else 'pending' end;
  elsif new.sms_sender_status is distinct from old.sms_sender_status
        and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.sms_sender_status := old.sms_sender_status;
  end if;
  return new;
end;
$$;
create trigger tenant_settings_sms_sender before update on public.tenant_settings
  for each row execute function public.sms_sender_guard();

-- ---------------------------------------------------------------------------
-- Templates (only overrides are stored; defaults live in the app's messages)
-- ---------------------------------------------------------------------------
create table public.sms_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  type        text not null check (type in ('confirmed', 'pending', 'reminder', 'rescheduled', 'cancelled')),
  locale      text not null check (locale in ('ka', 'en', 'ru')),
  body        text not null check (char_length(btrim(body)) between 1 and 600),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, type, locale)
);

-- ---------------------------------------------------------------------------
-- Message queue + log
-- ---------------------------------------------------------------------------
create table public.sms_messages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  client_id        uuid,
  booking_id       uuid,
  to_phone         text not null check (to_phone ~ '^\+[1-9][0-9]{7,14}$'),
  body             text not null,            -- SMS codes are stored blanked out
  kind             text not null check (kind in ('service', 'marketing')),
  type             text not null check (type in ('otp', 'confirmed', 'pending', 'reminder', 'rescheduled',
                                                 'cancelled', 'manual', 'marketing')),
  idempotency_key  text not null,
  status           text not null default 'queued'
                   check (status in ('queued', 'sending', 'sent', 'delivered', 'failed', 'skipped')),
  segments         integer not null check (segments between 1 and 10),
  attempts         integer not null default 0,
  send_after       timestamptz not null default now(),
  provider         text,
  provider_ref     text,
  error_code       text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  delivered_at     timestamptz,
  unique (tenant_id, idempotency_key),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete set null (client_id),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete set null (booking_id)
);
create index sms_messages_due on public.sms_messages (send_after) where status = 'queued';
create index sms_messages_log on public.sms_messages (tenant_id, created_at desc);
create index sms_messages_provider on public.sms_messages (provider, provider_ref);
create index on public.sms_messages (client_id);
create index on public.sms_messages (booking_id);

-- ---------------------------------------------------------------------------
-- Credits (in SMS segments). Balance = sum of delta.
-- ---------------------------------------------------------------------------
create table public.sms_credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  delta       integer not null,
  reason      text not null check (reason in ('trial', 'topup', 'send', 'refund', 'adjust')),
  message_id  uuid references public.sms_messages (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
create index on public.sms_credit_ledger (tenant_id, created_at desc);
create index on public.sms_credit_ledger (message_id);

-- ---------------------------------------------------------------------------
-- RLS: owners and admins read; nobody writes directly except templates
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sms_templates', 'sms_messages', 'sms_credit_ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (public.has_role(tenant_id, array[''owner'', ''admin'']))', t || '_select', t);
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.prevent_tenant_change()', t || '_tenant_fixed', t);
  end loop;
end $$;

create policy sms_templates_insert on public.sms_templates for insert to authenticated
  with check (public.has_role(tenant_id, array['owner', 'admin']));
create policy sms_templates_update on public.sms_templates for update to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']))
  with check (public.has_role(tenant_id, array['owner', 'admin']));
create policy sms_templates_delete on public.sms_templates for delete to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']));
revoke insert, update, delete on public.sms_messages, public.sms_credit_ledger from authenticated;

-- ---------------------------------------------------------------------------
-- Trial credits for every business (new and existing)
-- ---------------------------------------------------------------------------
create or replace function public.sms_trial_credits()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sms_credit_ledger (tenant_id, delta, reason, note) values (new.id, 50, 'trial', 'trial');
  return new;
end;
$$;
create trigger tenants_sms_trial after insert on public.tenants
  for each row execute function public.sms_trial_credits();

insert into public.sms_credit_ledger (tenant_id, delta, reason, note)
select t.id, 50, 'trial', 'trial' from public.tenants t
where not exists (select 1 from public.sms_credit_ledger l where l.tenant_id = t.id and l.reason = 'trial');

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Balance for the owner/admin screens (and the server).
create or replace function public.sms_balance(p_tenant uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres') and not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((select sum(delta) from public.sms_credit_ledger where tenant_id = p_tenant), 0);
end;
$$;

-- Adds a message to the queue once (same key → same message). Marketing goes
-- only to clients whose latest SMS consent is "yes"; otherwise it is logged as skipped.
create or replace function public.sms_enqueue(
  p_tenant uuid, p_to text, p_body text, p_kind text, p_type text, p_key text, p_segments integer,
  p_client uuid default null, p_booking uuid default null, p_send_after timestamptz default now(),
  p_created_by uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status text := 'queued';
begin
  if p_kind = 'marketing' and not exists (
    select 1 from public.client_consents c
    where c.client_id = p_client and c.tenant_id = p_tenant and c.channel = 'sms'
      and c.at = (select max(at) from public.client_consents x where x.client_id = p_client and x.channel = 'sms')
      and c.granted
  ) then
    v_status := 'skipped';
  end if;
  insert into public.sms_messages (tenant_id, client_id, booking_id, to_phone, body, kind, type, idempotency_key,
                                   status, segments, send_after, created_by, error_code)
  values (p_tenant, p_client, p_booking, p_to, p_body, p_kind, p_type, p_key, v_status, p_segments,
          coalesce(p_send_after, now()), p_created_by, case when v_status = 'skipped' then 'no_consent' end)
  on conflict (tenant_id, idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.sms_messages where tenant_id = p_tenant and idempotency_key = p_key;
  end if;
  return v_id;
end;
$$;

-- Picks due messages (or one given message) for sending and reserves credits.
-- Messages of a business without enough credits fail with "no_credits".
create or replace function public.sms_claim(p_limit integer default 50, p_only uuid default null)
returns setof public.sms_messages language plpgsql security definer set search_path = '' as $$
declare m public.sms_messages; v_balance integer;
begin
  for m in
    select * from public.sms_messages
    where status = 'queued' and (p_only is null and send_after <= now() or id = p_only)
    order by send_after limit p_limit
    for update skip locked
  loop
    perform pg_advisory_xact_lock(hashtext('sms-credits:' || m.tenant_id));
    select coalesce(sum(delta), 0) into v_balance from public.sms_credit_ledger where tenant_id = m.tenant_id;
    if v_balance < m.segments then
      update public.sms_messages set status = 'failed', error_code = 'no_credits' where id = m.id;
      continue;
    end if;
    insert into public.sms_credit_ledger (tenant_id, delta, reason, message_id)
    values (m.tenant_id, -m.segments, 'send', m.id);
    update public.sms_messages set status = 'sending', attempts = attempts + 1 where id = m.id
      returning * into m;
    return next m;
  end loop;
end;
$$;

-- Result of one send attempt. Failures give the credits back; temporary
-- failures are retried up to 3 attempts with growing pauses.
create or replace function public.sms_finish(
  p_id uuid, p_ok boolean, p_provider text, p_ref text, p_error text default null, p_retry boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare m public.sms_messages;
begin
  select * into m from public.sms_messages where id = p_id for update;
  if m.id is null or m.status <> 'sending' then return; end if;
  if p_ok then
    update public.sms_messages set status = 'sent', sent_at = now(), provider = p_provider, provider_ref = p_ref,
      error_code = null where id = p_id;
  else
    insert into public.sms_credit_ledger (tenant_id, delta, reason, message_id)
    values (m.tenant_id, m.segments, 'refund', m.id);
    update public.sms_messages set
      status = case when p_retry and m.attempts < 3 then 'queued' else 'failed' end,
      send_after = now() + make_interval(mins => 2 * m.attempts),
      provider = p_provider, error_code = left(p_error, 100)
    where id = p_id;
  end if;
end;
$$;

-- Delivery report from the provider (webhook or polling).
create or replace function public.sms_delivery(p_provider text, p_ref text, p_delivered boolean, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update public.sms_messages set
    status = case when p_delivered then 'delivered' else 'failed' end,
    delivered_at = case when p_delivered then now() end,
    error_code = case when p_delivered then null else left(p_error, 100) end
  where provider = p_provider and provider_ref = p_ref and status in ('sent', 'sending');
$$;

-- Platform admin tops up a business (manual for now).
create or replace function public.sms_topup(p_tenant uuid, p_segments integer, p_note text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.sms_credit_ledger (tenant_id, delta, reason, note)
  values (p_tenant, p_segments, case when p_segments >= 0 then 'topup' else 'adjust' end, p_note);
$$;

-- Bookings whose reminder is due now. The server writes the text (templates,
-- Georgian dates) and queues it with key reminder:{offset}:{booking}:{starts_at},
-- so a moved booking gets a fresh reminder and nothing is sent twice.
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
        and m.idempotency_key = 'reminder:' || o.offset_min || ':' || b.id || ':' || extract(epoch from b.starts_at)::bigint
    );
$$;

-- Unsubscribe link from a marketing SMS: records a "no" (only if it was "yes").
create or replace function public.sms_unsubscribe(p_client uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.clients where id = p_client;
  if v_tenant is null then return; end if;
  if exists (
    select 1 from public.client_consents c where c.client_id = p_client and c.channel = 'sms' and c.granted
      and c.at = (select max(at) from public.client_consents x where x.client_id = p_client and x.channel = 'sms')
  ) then
    insert into public.client_consents (tenant_id, client_id, channel, granted, source)
    values (v_tenant, p_client, 'sms', false, 'unsubscribe');
    perform public.write_audit(v_tenant, 'consent.unsubscribed', 'client', p_client::text, '{"channel": "sms"}');
  end if;
end;
$$;

grant execute on function public.sms_balance(uuid) to authenticated, service_role;
do $$
declare f text;
begin
  foreach f in array array[
    'public.sms_enqueue(uuid, text, text, text, text, text, integer, uuid, uuid, timestamptz, uuid)',
    'public.sms_claim(integer, uuid)',
    'public.sms_finish(uuid, boolean, text, text, text, boolean)',
    'public.sms_delivery(text, text, boolean, text)',
    'public.sms_topup(uuid, integer, text)',
    'public.sms_due_reminders()',
    'public.sms_unsubscribe(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
