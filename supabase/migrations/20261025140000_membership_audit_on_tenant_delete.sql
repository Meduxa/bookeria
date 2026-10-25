-- Deleting a tenant cascades to its memberships. The membership audit trigger
-- then tried to write an audit_log row for the tenant being deleted, which
-- violated the audit_log → tenants foreign key, so no tenant could be deleted.
-- Skip the per-membership audit when the tenant itself is going away; the
-- business-deletion flow (Phase 6) records that event at platform level.

create or replace function public.audit_membership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.tenants t where t.id = coalesce(new.tenant_id, old.tenant_id)) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    perform public.write_audit(new.tenant_id, 'membership.updated', 'membership', new.id::text,
      jsonb_build_object('user_id', new.user_id, 'from_role', old.role, 'to_role', new.role,
                         'from_status', old.status, 'to_status', new.status));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_audit(old.tenant_id, 'membership.removed', 'membership', old.id::text,
      jsonb_build_object('user_id', old.user_id, 'role', old.role));
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.audit_membership_change() from public, anon, authenticated;
