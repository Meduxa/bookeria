# Bookeria — Build Roadmap

Work one phase at a time. Claude Code ticks the boxes and updates `CHANGELOG.md` at the end of each phase. Rough durations assume a few focused hours per day.

## Phase 0 — Foundation (≈ 2–4 days)
✅ Done 2026-10-25

- [x] Tools checked (Node 24 LTS, Git), Git repo initialised — no Docker (no admin rights on the laptop), see decision 002
- [x] Next.js 16 + TypeScript (strict) + Tailwind 4 + shadcn/ui
- [x] Supabase EU cloud **dev** project `bookeria-dev` (Frankfurt) instead of local Docker; env files; typed Supabase clients (server, browser, admin)
- [x] next-intl (ka default — always, not from browser language — en, ru), temporary Noto Sans Georgian font (final font in Phase 2)
- [x] ESLint, Prettier, Vitest, Playwright, RLS test setup (Vitest integration tests against the dev project)
- [x] Migration: tenants, profiles, memberships, invitations, audit_log + RLS + isolation tests (32)
- [x] Sign-up → create business (salon/dental) → invite staff (link) → accept → dashboard shell (sidebar desktop, bottom nav mobile)
- [x] Seed: demo salon + demo dental clinic (`npm.cmd run db:seed`)
- [x] `APP_NAME` constant
- [ ] Production Supabase project (separate from dev) — create before the pilot
- [ ] Transactional email provider (invites + sign-up confirmation) — needed before the pilot

## Phase 1 — Services, staff, clients (≈ 1 week) — SPEC 4.1–4.4
- [ ] Business settings (hours, holidays, booking rules)
- [ ] Locations (data model; one in UI)
- [ ] Service categories, services, variants, add-ons, per-staff overrides
- [ ] Price list import (CSV/Excel) with preview and error report
- [ ] Staff profiles, weekly schedules, overrides, time off, services per staff
- [ ] Resources (chairs/rooms) for dental
- [ ] Clients: card, search, tags, important note, consents, history placeholder
- [ ] Client import (CSV/Excel), duplicate detection, merge
- [ ] Client export / anonymise (data subject requests)

## Phase 2 — Design system from Figma (≈ 3–5 days)
- [ ] Screenshots in `design/references/`, Figma link received
- [ ] Tokens extracted → `design/tokens.json` → CSS variables / Tailwind theme (light + dark if designed)
- [ ] Core components: buttons, inputs, selects, cards, badges, dialogs, sheets, tabs, toasts, empty states, table, avatar, date/time pickers
- [ ] App shell: sidebar (desktop), bottom navigation (mobile)
- [ ] Existing screens restyled; visual check against Figma at 375px and 1440px

## Phase 3 — Calendar and bookings (≈ 2 weeks) — SPEC 4.5–4.7
- [ ] Availability engine (booking-engine skill) with unit tests
- [ ] Exclusion constraints against double booking (staff + resource)
- [ ] Calendar: day (by staff / by resource), week, agenda (mobile), month counts
- [ ] Create / edit / move (drag & drop) / resize / cancel bookings; multi-service visits
- [ ] Statuses + status history; walk-ins; recurring bookings; waitlist
- [ ] Realtime updates between admins
- [ ] Import existing bookings from CSV/Excel (column mapping, preview, conflict report, no SMS by default)
- [ ] Staff view: today / upcoming / past, actions, own stats
- [ ] Checkout: payment methods, discounts, daily cash summary

## Phase 4 — Public online booking page (≈ 1 week) — SPEC 4.8
- [ ] `/book/[slug]` flow, mobile-first, ka default
- [ ] Real availability, "any staff" option
- [ ] Consents (marketing unchecked by default)
- [ ] SMS OTP (after Phase 5 adapter exists — stub until then)
- [ ] Manage-booking link (confirm / cancel / reschedule within policy)
- [ ] .ics "add to calendar", QR code, link sharing
- [ ] Rate limiting and bot protection

## Phase 5 — SMS (≈ 1 week) — SPEC 4.9
- [ ] SMS adapter interface + first provider + fake provider for tests
- [ ] Templates (ka/en/ru) with variables, character & segment counter
- [ ] Sender name settings and status
- [ ] Scheduled reminders job (idempotent), quiet hours
- [ ] Delivery status (webhook or polling), message log
- [ ] SMS credits ledger, low-balance warning
- [ ] Manual SMS to client / list (consent respected)

## Phase 6 — Reports, settings, polish, production (≈ 1–2 weeks) — SPEC 4.12–4.15
- [ ] Dashboard home + onboarding checklist
- [ ] Reports with filters + Excel export
- [ ] Audit log viewer, full business export, business deletion flow
- [ ] Trial + plans + plan limits; platform admin area
- [ ] PWA (manifest, icons, install prompt), performance pass
- [ ] Sentry, backups check, security review, accessibility pass
- [ ] Terms of service, privacy policy, data processing agreement pages (texts from lawyer)
- [ ] Production deployment + custom domain

## 🚀 Pilot with 2–3 salons + 1 dental clinic (2–4 weeks of real use, fix feedback)

## Go-to-market (from IDEAS.docx)
- [ ] Short, friendly **video tutorial** (2–3 min, Georgian, with subtitles) showing a salon's day in Bookeria: add a service → booking from Instagram link → SMS reminder → checkout. Send it to prospects.
- [ ] Short feature clips (30–60 s each) for Instagram/Facebook
- [ ] Demo account with realistic seeded data for sales calls
- [ ] Landing page (Webflow) with pricing, video and trial sign-up

## Phase 7 — Marketing email (≈ 1 week) — SPEC 4.10
- [ ] Email adapter + provider, contact & consent sync
- [ ] Segments, campaign editor, test send, schedule
- [ ] Unsubscribe webhook → consent update; stats
- [ ] Targeted special offers: combined segment filters, SMS + email, offer code / pre-applied booking link, results tracking

## Phase 8 — Online payments (≈ 1–2 weeks) — SPEC 4.11
- [ ] Payment adapter + Georgian gateway (per-tenant merchant account)
- [ ] Deposits on booking, payment links, refunds
- [ ] Signed webhooks, payment status on bookings, reconciliation report

## v2 ideas
Gift cards, memberships/packages, inventory, review requests, Viber/WhatsApp messages, Google Calendar sync for staff, embed widget, 2FA, processing-time double booking, AI suggestions.
