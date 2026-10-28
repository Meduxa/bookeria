-- Short addresses (name.bookeria.ge): a business may not take a name we use
-- ourselves (www, app, admin, …). Keep in sync with RESERVED_SLUGS in src/lib/site.ts.
alter table public.tenants add constraint tenants_slug_not_reserved check (slug not in (
  'www', 'app', 'admin', 'api', 'auth', 'book', 'login', 'signup', 'dashboard', 'mail', 'email', 'smtp', 'help', 'support', 'status', 'blog', 'docs', 'cdn', 'static', 'assets', 'media', 'img', 'dev', 'staging', 'test', 'demo', 'preview', 'm', 'u', 'legal', 'bookeria', 'billing', 'pay', 'payments'
));
