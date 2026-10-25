-- Live calendar: send booking changes over Supabase Realtime. RLS still
-- decides which rows each subscriber receives.
alter publication supabase_realtime add table public.bookings, public.booking_items;

-- Staff create their own bookings (Levan, Phase 3), so they may add a new
-- client — always with themselves as preferred staff, which is also what lets
-- them see that client afterwards.
drop policy clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated
  with check (
    public.has_role(tenant_id, array['owner', 'admin'])
    or (public.has_role(tenant_id, array['staff'])
        and preferred_staff_id is not null
        and preferred_staff_id = public.current_staff_id(tenant_id))
  );
