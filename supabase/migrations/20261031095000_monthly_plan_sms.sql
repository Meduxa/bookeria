-- Included SMS of the plan, added once per calendar month (daily job; the note
-- 'plan:YYYY-MM' makes a second run in the same month add nothing).
create or replace function public.grant_monthly_sms()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_month text := to_char(now() at time zone 'Asia/Tbilisi', 'YYYY-MM'); n integer;
begin
  insert into public.sms_credit_ledger (tenant_id, delta, reason, note)
  select t.id, p.sms_per_month, 'topup', 'plan:' || v_month
  from public.tenants t join public.plans p on p.code = t.plan
  where t.status = 'active' and p.sms_per_month > 0
    and not exists (select 1 from public.sms_credit_ledger l where l.tenant_id = t.id and l.note = 'plan:' || v_month);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.grant_monthly_sms() from public, anon, authenticated;
grant execute on function public.grant_monthly_sms() to service_role;
