# 011 — Error reports (Sentry) and email (Resend), switched on by settings

**Context.** Production needs to know about errors and to send invitation and booking emails (Phase 6b). Levan chose Resend (3,000 emails/month free). Neither account exists yet (2026-10-26).

**Decision.**
- **Sentry** is wired (`src/instrumentation.ts`, `src/instrumentation-client.ts`) and runs only when `NEXT_PUBLIC_SENTRY_DSN` is set; the browser loads the library only then. Errors only (no performance tracing, no session replay). Before a report leaves the app, cookies, headers, request bodies, query strings, user identity and console breadcrumbs are removed (`src/lib/sentry-options.ts`, tested) — no client names or phone numbers reach Sentry. Use Sentry's EU data region. Source-map upload is not set up yet (stack traces are minified) — add with an auth token later if needed.
- **Resend** is a provider behind the existing email adapter (`EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM`), using the HTTP API with an idempotency key. Sign-up confirmation and password emails are sent by Supabase Auth itself — in production, point Supabase's SMTP settings at Resend (see `docs/go-live.md`).

**Consequence.** Nothing changes until the keys are entered; then both work without code changes. CSP allows the Sentry host from the DSN automatically.
