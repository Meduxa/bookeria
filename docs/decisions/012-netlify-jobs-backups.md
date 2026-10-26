# 012 — Netlify, scheduled jobs and backups

**Context.** Levan chose Netlify (commercial use on the free tier), the Supabase free plan to start, GitHub for the code (2026-10-26).

**Decision.**
- Netlify builds from GitHub (`netlify.toml`, Node 24). Two scheduled functions call the app's protected job routes with `CRON_SECRET`: `cron-sms` every minute, `cron-daily` at 23:30 UTC (03:30 Tbilisi). Functions region Frankfurt where the plan allows.
- Every push runs typecheck, lint, format check and unit tests on GitHub (no secrets). Database and browser tests stay on the laptop against the dev project.
- Demo seeding and the database tests refuse any Supabase project except the dev one (`scripts/dev-project.mts`) — production is never written by tests.
- Free plan → no Supabase backups: a GitHub workflow makes an encrypted (AES-256, passphrase only Levan holds) nightly dump kept 30 days, active only when its secrets are set. To be replaced by Supabase Pro backups; lawyer to confirm the interim.
- Without an SMS company, production SMS are logged as "not sent" (`no_provider`) and credits are returned instead of crashing the job.

**Consequence.** Going live is a sequence of account steps for Levan (`docs/go-live.md`); no code changes are needed for them. Real sign-ups need email (Resend + a domain).
