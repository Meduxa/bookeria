-- audit_log's time column is "at" (not created_at).
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
    greatest(t.updated_at, (select max(a.at) from public.audit_log a where a.tenant_id = t.id),
             (select max(b.created_at) from public.bookings b where b.tenant_id = t.id)),
    (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id
      where m.tenant_id = t.id and m.role = 'owner' order by m.created_at limit 1)
  from public.tenants t
  order by t.created_at desc;
end;
$$;
