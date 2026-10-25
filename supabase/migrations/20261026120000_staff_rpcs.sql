-- Atomic "replace all" operations for a staff member, and linking a staff
-- profile to a login. The replace functions run with the CALLER's rights
-- (security invoker), so the table RLS policies decide; they only add
-- atomicity and validation.

-- Weekly schedule. p_rows: [{weekday, start_time, end_time}]
create or replace function public.set_staff_schedule(p_staff uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.staff where id = p_staff;
  if v_tenant is null or not public.has_role(v_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 70 then
    raise exception 'invalid schedule' using errcode = '22023';
  end if;

  -- intervals on the same weekday must not overlap
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) a(weekday smallint, start_time time, end_time time)
    join jsonb_to_recordset(p_rows) b(weekday smallint, start_time time, end_time time)
      on a.weekday = b.weekday and (a.start_time, a.end_time) <> (b.start_time, b.end_time)
     and a.start_time < b.end_time and b.start_time < a.end_time
  ) then
    raise exception 'overlapping intervals' using errcode = '23P01';
  end if;

  delete from public.staff_schedules where staff_id = p_staff;
  insert into public.staff_schedules (tenant_id, staff_id, weekday, start_time, end_time)
  select v_tenant, p_staff, r.weekday, r.start_time, r.end_time
  from jsonb_to_recordset(p_rows) r(weekday smallint, start_time time, end_time time);
end;
$$;

-- Services a staff member performs, with optional own price / duration.
-- p_rows: [{service_id, price_minor_override, duration_min_override}]
create or replace function public.set_staff_services(p_staff uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.staff where id = p_staff;
  if v_tenant is null or not public.has_role(v_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid services' using errcode = '22023';
  end if;

  delete from public.staff_services where staff_id = p_staff;
  -- composite FKs reject service ids from another tenant
  insert into public.staff_services (tenant_id, staff_id, service_id, price_minor_override, duration_min_override)
  select v_tenant, p_staff, r.service_id, r.price_minor_override, r.duration_min_override
  from jsonb_to_recordset(p_rows) r(service_id uuid, price_minor_override integer, duration_min_override integer);
end;
$$;

-- Link a staff profile to a member's login (or unlink with p_membership null).
-- Owner/admin; both must belong to the same tenant.
create or replace function public.link_staff_login(p_staff uuid, p_membership uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.staff where id = p_staff;
  if v_tenant is null or not public.has_role(v_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_membership is not null and not exists (
    select 1 from public.memberships where id = p_membership and tenant_id = v_tenant
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.memberships set staff_id = null where staff_id = p_staff;
  if p_membership is not null then
    update public.memberships set staff_id = p_staff where id = p_membership;
  end if;
  perform public.write_audit(v_tenant, 'staff.login_linked', 'staff', p_staff::text,
    jsonb_build_object('membership', p_membership));
end;
$$;

revoke execute on function public.set_staff_schedule(uuid, jsonb) from public, anon;
revoke execute on function public.set_staff_services(uuid, jsonb) from public, anon;
revoke execute on function public.link_staff_login(uuid, uuid) from public, anon;
grant execute on function public.set_staff_schedule(uuid, jsonb) to authenticated;
grant execute on function public.set_staff_services(uuid, jsonb) to authenticated;
grant execute on function public.link_staff_login(uuid, uuid) to authenticated;
