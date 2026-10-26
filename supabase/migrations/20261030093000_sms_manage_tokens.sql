-- Manage-link keys are stored only as an HMAC, so an SMS that carries a link
-- (reminder, confirmation of an admin booking) gets a fresh key for the booking.
create or replace function public.add_manage_token(p_booking uuid, p_token_hash text)
returns void language sql security definer set search_path = '' as $$
  insert into public.booking_manage_tokens (token_hash, tenant_id, booking_id)
  select p_token_hash, b.tenant_id, b.id from public.bookings b where b.id = p_booking;
$$;
revoke all on function public.add_manage_token(uuid, text) from public, anon, authenticated;
grant execute on function public.add_manage_token(uuid, text) to service_role;
