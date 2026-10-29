-- Levan's first prices (2026-10-29): Starter and Standard, 10 ₾ below the main competitor,
-- with the same staff limits and included SMS. "Premium" (large chains) is priced
-- individually and is not a self-service plan, so it is not a row here; the old
-- "Clinic" placeholder is no longer offered to new businesses (existing ones keep it).
-- Codes stay the same (start, pro) — they are referenced by tenants.plan.
update public.plans
   set name = 'Starter', price_minor = 3900, max_staff = 1, sms_per_month = 900, sort_order = 1, updated_at = now()
 where code = 'start';
update public.plans
   set name = 'Standard', price_minor = 8900, max_staff = 15, sms_per_month = 1500, sort_order = 2, updated_at = now()
 where code = 'pro';
update public.plans set active = false, updated_at = now() where code = 'clinic';
