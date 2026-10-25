-- Phase 1: business settings, locations, resources, services, staff, schedules,
-- clients and consents.
--
-- Isolation rules used throughout:
--  * every table has tenant_id, RLS enabled + forced, one policy per command;
--  * every reference to another tenant table is a composite FK (id, tenant_id),
--    so a row can never point at another tenant's row, even by a known id;
--  * tenant_id can never be changed after insert (trigger).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.prevent_tenant_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- jsonb {ka, en, ru} with at least one non-empty name, nothing else
create or replace function public.valid_i18n(p jsonb, p_required boolean default true)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and (select bool_and(k in ('ka', 'en', 'ru') and jsonb_typeof(p -> k) = 'string'
                         and char_length(p ->> k) <= 300)
         from jsonb_object_keys(p) k) is not false
    and (not p_required or exists (
      select 1 from jsonb_each_text(p) e where char_length(btrim(e.value)) > 0))
$$;

create or replace function public.valid_staff_color(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p in ('green', 'teal', 'sky', 'blue', 'indigo', 'violet', 'pink', 'rose', 'orange', 'amber')
$$;

-- ---------------------------------------------------------------------------
-- Business settings (1 row per tenant) and locations
-- ---------------------------------------------------------------------------

create table public.tenant_settings (
  tenant_id                 uuid primary key references public.tenants (id) on delete cascade,
  phone                     text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email                     text check (email is null or email = lower(email)),
  min_notice_min            integer not null default 120 check (min_notice_min between 0 and 10080),
  max_days_ahead            integer not null default 60 check (max_days_ahead between 1 and 365),
  cancel_window_min         integer not null default 1440 check (cancel_window_min between 0 and 10080),
  slot_step_min             integer not null default 15 check (slot_step_min in (5, 10, 15, 20, 30, 60)),
  online_requires_approval  boolean not null default false,
  staff_sees_all_clients    boolean not null default false,
  staff_sees_all_bookings   boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  address     text check (char_length(address) <= 300),
  phone       text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_primary  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, tenant_id)
);
create unique index locations_one_primary on public.locations (tenant_id) where is_primary;

-- opening hours: several intervals per weekday (1 = Monday … 7 = Sunday)
create table public.location_hours (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  location_id  uuid not null,
  weekday      smallint not null check (weekday between 1 and 7),
  start_time   time not null,
  end_time     time not null check (end_time > start_time),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete cascade
);

-- holidays and closed days (location_id null = whole business)
create table public.closures (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  location_id  uuid,
  date         date not null,
  reason       text check (char_length(reason) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete cascade
);
create unique index closures_unique_day on public.closures (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), date);

-- chairs, rooms, equipment (dental)
create table public.resources (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  location_id  uuid,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  type         text not null check (type in ('chair', 'room', 'equipment')),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete set null (location_id)
);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------

create table public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name_i18n   jsonb not null check (public.valid_i18n(name_i18n)),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  category_id       uuid,
  name_i18n         jsonb not null check (public.valid_i18n(name_i18n)),
  description_i18n  jsonb not null default '{}'::jsonb check (public.valid_i18n(description_i18n, false)),
  price_type        text not null default 'fixed' check (price_type in ('fixed', 'from', 'range')),
  price_minor       integer not null check (price_minor between 0 and 100000000),
  price_max_minor   integer check (price_max_minor between 0 and 100000000),
  currency          text not null default 'GEL' check (currency = 'GEL'),
  duration_min      integer not null check (duration_min between 5 and 720),
  buffer_after_min  integer not null default 0 check (buffer_after_min between 0 and 240),
  color             text check (color is null or public.valid_staff_color(color)),
  active            boolean not null default true,
  bookable_online   boolean not null default true,
  deposit_type      text not null default 'none' check (deposit_type in ('none', 'fixed', 'percent')),
  deposit_value     integer not null default 0 check (deposit_value >= 0),
  resource_type     text check (resource_type in ('chair', 'room', 'equipment')),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (category_id, tenant_id) references public.service_categories (id, tenant_id) on delete set null (category_id),
  check ((price_type = 'range') = (price_max_minor is not null)),
  check (price_max_minor is null or price_max_minor > price_minor),
  check (deposit_type <> 'percent' or deposit_value <= 100)
);

create table public.service_variants (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  service_id    uuid not null,
  name_i18n     jsonb not null check (public.valid_i18n(name_i18n)),
  price_minor   integer not null check (price_minor between 0 and 100000000),
  duration_min  integer not null check (duration_min between 5 and 720),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (service_id, tenant_id) references public.services (id, tenant_id) on delete cascade
);

create table public.service_addons (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  service_id    uuid not null,
  name_i18n     jsonb not null check (public.valid_i18n(name_i18n)),
  price_minor   integer not null check (price_minor between 0 and 100000000),
  duration_min  integer not null default 0 check (duration_min between 0 and 240),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (service_id, tenant_id) references public.services (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Staff and schedules
-- ---------------------------------------------------------------------------

create table public.staff (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  location_id      uuid,
  display_name     text not null check (char_length(btrim(display_name)) between 1 and 120),
  position         text check (char_length(position) <= 120),
  position_type    text not null default 'master' check (position_type in ('master', 'doctor', 'assistant', 'other')),
  color            text not null default 'green' check (public.valid_staff_color(color)),
  photo_path       text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/'),
  bio              text check (char_length(bio) <= 1000),
  phone            text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email            text check (email is null or email = lower(email)),
  bookable_online  boolean not null default true,
  commission_pct   numeric(5, 2) not null default 0 check (commission_pct between 0 and 100),
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete set null (location_id)
);

-- a login can be linked to at most one staff profile per tenant
alter table public.memberships
  add constraint memberships_staff_fk foreign key (staff_id, tenant_id)
  references public.staff (id, tenant_id) on delete set null (staff_id);
create unique index memberships_one_login_per_staff on public.memberships (staff_id) where staff_id is not null;

create table public.staff_services (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants (id) on delete cascade,
  staff_id               uuid not null,
  service_id             uuid not null,
  price_minor_override   integer check (price_minor_override between 0 and 100000000),
  duration_min_override  integer check (duration_min_override between 5 and 720),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (staff_id, service_id),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade,
  foreign key (service_id, tenant_id) references public.services (id, tenant_id) on delete cascade
);

create table public.staff_schedules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  staff_id    uuid not null,
  weekday     smallint not null check (weekday between 1 and 7),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade
);

-- a date-specific day replaces the weekly schedule for that date:
-- one row with is_day_off, or one row per working interval
create table public.staff_schedule_overrides (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  staff_id    uuid not null,
  date        date not null,
  is_day_off  boolean not null default false,
  start_time  time,
  end_time    time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade,
  check (is_day_off = (start_time is null and end_time is null)),
  check (end_time is null or end_time > start_time)
);

create table public.time_off (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  staff_id    uuid not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null check (ends_at > starts_at),
  reason      text not null default 'other' check (reason in ('vacation', 'sick', 'break', 'other')),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Clients and consents
-- ---------------------------------------------------------------------------

create table public.clients (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  first_name          text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name           text check (char_length(last_name) <= 80),
  phone_e164          text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email               text check (email is null or (email = lower(email) and email like '%_@_%')),
  birthday            date check (birthday is null or birthday between '1900-01-01' and '2100-01-01'),
  gender              text check (gender in ('female', 'male', 'other')),
  tags                text[] not null default '{}' check (cardinality(tags) <= 20),
  source              text check (source in ('walk_in', 'phone', 'instagram', 'facebook', 'referral', 'online', 'import', 'other')),
  notes               text check (char_length(notes) <= 4000),
  important_note      text check (char_length(important_note) <= 500),
  preferred_staff_id  uuid,
  no_show_count       integer not null default 0 check (no_show_count >= 0),
  blocked_online      boolean not null default false,
  anonymized_at       timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (preferred_staff_id, tenant_id) references public.staff (id, tenant_id) on delete set null (preferred_staff_id)
);
create unique index clients_phone_unique on public.clients (tenant_id, phone_e164) where phone_e164 is not null;
create index clients_name_search on public.clients (tenant_id, lower(first_name), lower(last_name));

-- consent history: append-only events; the latest row per channel is the state
create table public.client_consents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  client_id    uuid not null,
  channel      text not null check (channel in ('sms', 'email')),
  purpose      text not null default 'marketing' check (purpose = 'marketing'),
  granted      boolean not null,
  source       text not null check (source in ('admin', 'booking_page', 'import', 'unsubscribe', 'client_request')),
  recorded_by  uuid references auth.users (id) on delete set null,
  at           timestamptz not null default now(),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade
);
create index client_consents_latest on public.client_consents (client_id, channel, at desc);

-- ---------------------------------------------------------------------------
-- Indexes, triggers, RLS for all tables
-- ---------------------------------------------------------------------------

create index on public.locations (tenant_id);
create index on public.location_hours (tenant_id, location_id);
create index on public.closures (tenant_id, date);
create index on public.resources (tenant_id);
create index on public.service_categories (tenant_id);
create index on public.services (tenant_id, category_id);
create index on public.service_variants (tenant_id, service_id);
create index on public.service_addons (tenant_id, service_id);
create index on public.staff (tenant_id);
create index on public.staff_services (tenant_id, service_id);
create index on public.staff_schedules (tenant_id, staff_id);
create index on public.staff_schedule_overrides (tenant_id, staff_id, date);
create index on public.time_off (tenant_id, staff_id, starts_at);
create index on public.client_consents (tenant_id);

do $$
declare
  t text;
begin
  foreach t in array array['tenant_settings', 'locations', 'location_hours', 'closures', 'resources',
    'service_categories', 'services', 'service_variants', 'service_addons', 'staff', 'staff_services',
    'staff_schedules', 'staff_schedule_overrides', 'time_off', 'clients', 'client_consents']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.prevent_tenant_change()', t || '_tenant_fixed', t);
    if t <> 'client_consents' then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    end if;
  end loop;

  -- Catalogue, staff and schedules: every member reads, owner/admin write.
  foreach t in array array['tenant_settings', 'locations', 'location_hours', 'closures', 'resources',
    'service_categories', 'services', 'service_variants', 'service_addons', 'staff', 'staff_services',
    'staff_schedules', 'staff_schedule_overrides', 'time_off']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (tenant_id in (select public.user_tenant_ids()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(tenant_id, array[''owner'',''admin'']))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(tenant_id, array[''owner'',''admin''])) with check (public.has_role(tenant_id, array[''owner'',''admin'']))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(tenant_id, array[''owner'',''admin'']))', t || '_delete', t);
  end loop;
end;
$$;

-- tenant_settings: one row created with the tenant; never inserted or deleted by users
drop policy tenant_settings_insert on public.tenant_settings;
drop policy tenant_settings_delete on public.tenant_settings;

-- the staff profile linked to the current user in a tenant (null if none)
create or replace function public.current_staff_id(p_tenant uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.staff_id from public.memberships m
  where m.user_id = auth.uid() and m.tenant_id = p_tenant and m.status = 'active'
$$;

-- Clients: owner/admin see all; staff see clients that chose them as preferred
-- staff, or all clients when the business allows it. (Phase 3 adds "clients
-- with a booking with me".)
create or replace function public.can_see_client(p_tenant uuid, p_preferred_staff uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_tenant, array['owner', 'admin'])
    or (public.has_role(p_tenant, array['staff']) and (
      coalesce((select s.staff_sees_all_clients from public.tenant_settings s where s.tenant_id = p_tenant), false)
      or (p_preferred_staff is not null and p_preferred_staff = public.current_staff_id(p_tenant))
    ))
$$;

create policy clients_select on public.clients for select to authenticated
  using (public.can_see_client(tenant_id, preferred_staff_id));
create policy clients_insert on public.clients for insert to authenticated
  with check (public.has_role(tenant_id, array['owner', 'admin']));
create policy clients_update on public.clients for update to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']) and anonymized_at is null)
  with check (public.has_role(tenant_id, array['owner', 'admin']));
-- no delete policy: clients are anonymised (keeps history), or merged, via RPC

create policy client_consents_select on public.client_consents for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.tenant_id = client_consents.tenant_id
                 and public.can_see_client(c.tenant_id, c.preferred_staff_id)));
create policy client_consents_insert on public.client_consents for insert to authenticated
  with check (public.has_role(tenant_id, array['owner', 'admin']) and recorded_by = auth.uid()
              and source in ('admin', 'client_request'));
-- no update/delete: the history is the evidence

-- current consent per client and channel; runs with the caller's rights
create view public.client_consent_state with (security_invoker = true) as
  select distinct on (client_id, channel)
    tenant_id, client_id, channel, granted, source, at
  from public.client_consents
  order by client_id, channel, at desc;
revoke all on public.client_consent_state from anon;

-- ---------------------------------------------------------------------------
-- New businesses get settings + a primary location; backfill existing ones
-- ---------------------------------------------------------------------------

create or replace function public.init_tenant_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_location uuid;
  d smallint;
begin
  insert into public.tenant_settings (tenant_id) values (new.id) on conflict do nothing;
  insert into public.locations (tenant_id, name, is_primary) values (new.id, new.name, true)
    returning id into v_location;
  -- default opening hours Mon–Sat 10:00–20:00, editable in settings
  for d in 1..6 loop
    insert into public.location_hours (tenant_id, location_id, weekday, start_time, end_time)
    values (new.id, v_location, d, '10:00', '20:00');
  end loop;
  return new;
end;
$$;

create trigger tenants_init_defaults after insert on public.tenants
  for each row execute function public.init_tenant_defaults();

do $$
declare
  r record;
  v_location uuid;
  d smallint;
begin
  for r in select t.id, t.name from public.tenants t
           where not exists (select 1 from public.tenant_settings s where s.tenant_id = t.id)
  loop
    insert into public.tenant_settings (tenant_id) values (r.id);
    insert into public.locations (tenant_id, name, is_primary) values (r.id, r.name, true) returning id into v_location;
    for d in 1..6 loop
      insert into public.location_hours (tenant_id, location_id, weekday, start_time, end_time)
      values (r.id, v_location, d, '10:00', '20:00');
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: client data rights, merge, consent, imports
-- ---------------------------------------------------------------------------

-- Everything we hold about one client (data subject request). Owner only.
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
                          from public.client_consents cc where cc.client_id = c.id), '[]'::jsonb)
  ) into v_result
  from public.clients c where c.id = p_client;

  perform public.write_audit(v_tenant, 'client.exported', 'client', p_client::text);
  return v_result;
end;
$$;

-- Removes personal data but keeps the row, so visit counts and money totals in
-- reports stay correct. Irreversible. Owner only.
create or replace function public.anonymize_client(p_client uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.clients where id = p_client and anonymized_at is null;
  if v_tenant is null or not public.has_role(v_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.clients set
    first_name = '—', last_name = null, phone_e164 = null, email = null, birthday = null,
    gender = null, tags = '{}', notes = null, important_note = null, preferred_staff_id = null,
    blocked_online = false, anonymized_at = now()
  where id = p_client;
  delete from public.client_consents where client_id = p_client;
  perform public.write_audit(v_tenant, 'client.anonymized', 'client', p_client::text);
end;
$$;

-- Keep one card, fold the duplicate into it. Owner/admin.
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

  -- the duplicate's phone must be freed before the kept card can take it
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
  -- bookings are re-pointed here too once they exist (Phase 3)
  delete from public.clients where id = r.id;
  perform public.write_audit(k.tenant_id, 'client.merged', 'client', k.id::text,
    jsonb_build_object('removed', r.id));
end;
$$;

-- Price-list import: categories + services in one transaction. Rows are
-- validated in the app first; the table constraints check them again.
-- p_rows: [{category, name, price_type, price_minor, price_max_minor, duration_min}]
create or replace function public.import_services(p_tenant uuid, p_locale text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  row jsonb;
  v_cat uuid;
  v_cat_name text;
  v_count integer := 0;
  v_sort integer;
begin
  if not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_locale not in ('ka', 'en', 'ru') or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid import' using errcode = '22023';
  end if;

  select coalesce(max(sort_order), 0) into v_sort from public.services where tenant_id = p_tenant;
  for row in select * from jsonb_array_elements(p_rows)
  loop
    v_cat := null;
    v_cat_name := nullif(btrim(row ->> 'category'), '');
    if v_cat_name is not null then
      select id into v_cat from public.service_categories
      where tenant_id = p_tenant and lower(name_i18n ->> p_locale) = lower(v_cat_name) limit 1;
      if v_cat is null then
        insert into public.service_categories (tenant_id, name_i18n, sort_order)
        values (p_tenant, jsonb_build_object(p_locale, v_cat_name),
                (select coalesce(max(sort_order), 0) + 1 from public.service_categories where tenant_id = p_tenant))
        returning id into v_cat;
      end if;
    end if;

    v_sort := v_sort + 1;
    insert into public.services (tenant_id, category_id, name_i18n, price_type, price_minor, price_max_minor, duration_min, sort_order)
    values (p_tenant, v_cat, jsonb_build_object(p_locale, btrim(row ->> 'name')), row ->> 'price_type',
            (row ->> 'price_minor')::integer, (row ->> 'price_max_minor')::integer,
            (row ->> 'duration_min')::integer, v_sort);
    v_count := v_count + 1;
  end loop;

  perform public.write_audit(p_tenant, 'services.imported', 'service', null, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

-- Client import: new phones are inserted, existing phones are skipped (the
-- preview shows them as duplicates). Consent columns become consent events
-- with source 'import'. Returns {inserted, skipped}.
-- p_rows: [{first_name, last_name, phone_e164, email, birthday, notes, consent_sms, consent_email}]
create or replace function public.import_clients(p_tenant uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row jsonb;
  v_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  if not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'invalid import' using errcode = '22023';
  end if;

  for row in select * from jsonb_array_elements(p_rows)
  loop
    v_id := null;
    insert into public.clients (tenant_id, first_name, last_name, phone_e164, email, birthday, notes, source, created_by)
    values (p_tenant, btrim(row ->> 'first_name'), nullif(btrim(row ->> 'last_name'), ''),
            nullif(row ->> 'phone_e164', ''), nullif(lower(btrim(row ->> 'email')), ''),
            nullif(row ->> 'birthday', '')::date, nullif(row ->> 'notes', ''), 'import', auth.uid())
    on conflict (tenant_id, phone_e164) where phone_e164 is not null do nothing
    returning id into v_id;

    if v_id is null then
      v_skipped := v_skipped + 1;
    else
      v_inserted := v_inserted + 1;
      if (row ->> 'consent_sms')::boolean is true then
        insert into public.client_consents (tenant_id, client_id, channel, granted, source, recorded_by)
        values (p_tenant, v_id, 'sms', true, 'import', auth.uid());
      end if;
      if (row ->> 'consent_email')::boolean is true then
        insert into public.client_consents (tenant_id, client_id, channel, granted, source, recorded_by)
        values (p_tenant, v_id, 'email', true, 'import', auth.uid());
      end if;
    end if;
  end loop;

  perform public.write_audit(p_tenant, 'clients.imported', 'client', null,
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped));
  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff photos: public bucket (shown on the booking page), writes only into
-- your own tenant's folder by owner/admin.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-photos', 'staff-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.can_write_tenant_folder(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f-]{36}$' then
    return false;
  end if;
  return public.has_role(v_folder::uuid, array['owner', 'admin']);
end;
$$;

create policy staff_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-photos' and public.can_write_tenant_folder(name));
create policy staff_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'staff-photos' and public.can_write_tenant_folder(name))
  with check (bucket_id = 'staff-photos' and public.can_write_tenant_folder(name));
create policy staff_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'staff-photos' and public.can_write_tenant_folder(name));

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.user_tenant_ids() to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
grant execute on function public.shares_tenant_with(uuid) to authenticated;
grant execute on function public.current_staff_id(uuid) to authenticated;
grant execute on function public.can_see_client(uuid, uuid) to authenticated;
grant execute on function public.can_write_tenant_folder(text) to authenticated;
grant execute on function public.valid_i18n(jsonb, boolean) to authenticated;
grant execute on function public.valid_staff_color(text) to authenticated;
grant execute on function public.log_audit(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.create_tenant(text, text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.export_client(uuid) to authenticated;
grant execute on function public.anonymize_client(uuid) to authenticated;
grant execute on function public.merge_clients(uuid, uuid) to authenticated;
grant execute on function public.import_services(uuid, text, jsonb) to authenticated;
grant execute on function public.import_clients(uuid, jsonb) to authenticated;
