-- The business's own small website (the public booking page): cover photo, logo,
-- "about" text, social links and a colour theme. Lives in tenant_settings, so the
-- existing policies apply (owner/admin edit their own business; the public page
-- reads it on the server only — decision 007). Photos go to the existing
-- business-photos bucket under the business's own folder.

create or replace function public.valid_about(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and (select bool_and(k in ('ka', 'en', 'ru') and jsonb_typeof(p -> k) = 'string'
                         and char_length(p ->> k) <= 1000)
         from jsonb_object_keys(p) k) is not false
$$;
grant execute on function public.valid_about(jsonb) to authenticated;

alter table public.tenant_settings
  add column site_about      jsonb not null default '{}'::jsonb check (public.valid_about(site_about)),
  add column site_cover_path text check (site_cover_path is null or (
    site_cover_path like tenant_id::text || '/%' and site_cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$')),
  add column site_logo_path  text check (site_logo_path is null or (
    site_logo_path like tenant_id::text || '/%' and site_logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$')),
  add column site_instagram  text check (site_instagram is null or site_instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column site_facebook   text check (site_facebook is null or site_facebook ~ '^[A-Za-z0-9.-]{1,80}$'),
  add column site_theme      text not null default 'emerald'
                             check (site_theme in ('emerald', 'rose', 'plum', 'ocean', 'amber'));
