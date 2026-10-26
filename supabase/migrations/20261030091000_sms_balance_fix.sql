-- sms_balance runs as its owner, so current_user is always the owner there:
-- check the caller's role from the request (service_role = Bookeria's server).
create or replace function public.sms_balance(p_tenant uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((select sum(delta) from public.sms_credit_ledger where tenant_id = p_tenant), 0);
end;
$$;
