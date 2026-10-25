-- Replace a location's weekly opening hours atomically. Runs with the caller's
-- rights (RLS: owner/admin of that tenant). p_rows: [{weekday, start_time, end_time}]
create or replace function public.set_location_hours(p_location uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.locations where id = p_location;
  if v_tenant is null or not public.has_role(v_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 70 then
    raise exception 'invalid hours' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) a(weekday smallint, start_time time, end_time time)
    join jsonb_to_recordset(p_rows) b(weekday smallint, start_time time, end_time time)
      on a.weekday = b.weekday and (a.start_time, a.end_time) <> (b.start_time, b.end_time)
     and a.start_time < b.end_time and b.start_time < a.end_time
  ) then
    raise exception 'overlapping intervals' using errcode = '23P01';
  end if;

  delete from public.location_hours where location_id = p_location;
  insert into public.location_hours (tenant_id, location_id, weekday, start_time, end_time)
  select v_tenant, p_location, r.weekday, r.start_time, r.end_time
  from jsonb_to_recordset(p_rows) r(weekday smallint, start_time time, end_time time);
end;
$$;

revoke execute on function public.set_location_hours(uuid, jsonb) from public, anon;
grant execute on function public.set_location_hours(uuid, jsonb) to authenticated;
