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
✅ Done 2026-10-26 (built after the design foundation, see Phase 2 and decision 004)

- [x] Business settings (details, opening hours, holidays/closed days, booking rules, staff visibility)
- [x] Locations (data model; one primary location in UI, created with the business)
- [x] Service categories (reorder with buttons), services (fixed / from / range price), variants, add-ons, per-staff price/duration
- [x] Price list import (paste or CSV/XLSX) with preview and error report — tested with two real Georgian price lists
- [x] Staff profiles (photo, login link), weekly schedules (split shifts), date changes, time off, services per staff
- [x] Resources (chairs/rooms) for dental
- [x] Clients: card, server-side search, tags, important note, marketing consents with history, preferred staff, block online booking
- [x] Client import (paste or CSV/XLSX), duplicate detection (file + existing), merge
- [x] Client export (JSON) / anonymise (owner only, audited)
- [ ] Visit history on the client card — needs bookings (Phase 3)
- [ ] Staff levels — skipped by decision (per-staff price covers it)

## Phase 2 — Design system (≈ 3–5 days)
Design foundation done 2026-10-26 from screenshots + videos (no Figma file yet). Remaining items wait for Figma / calendar.

- [x] References in `design/references/` with notes on what we take from each (no Figma link yet)
- [x] Tokens → `design/tokens.json` → CSS variables / Tailwind theme, light + dark, contrast checked (≥ 4.5:1)
- [x] Core components: buttons, inputs, selects, cards, status pills, stat cards, dialogs, sheets (details panel), tabs, toasts, empty states, avatar with staff colour, colour swatches
- [x] App shell: grouped sidebar (desktop), bottom navigation + "More" page (mobile), dark-mode switch
- [x] Phase 0 + 1 screens in the new style; checked at 375px and 1280–1440px
- [ ] Final fonts and visual check against a Figma file (when available)
- [ ] Date/time picker components (with the calendar, Phase 3)

## Phase 3 — Calendar and bookings (≈ 2 weeks) — SPEC 4.5–4.7
Split into 3a and 3b with a report in between (Levan, 2026-10-26). Staff may create and move only their own bookings; admin bookings start as confirmed.

### 3a ✅ Done 2026-10-27
- [x] Availability engine (booking-engine skill) with unit tests (17; #14 concurrency runs against the database)
- [x] Exclusion constraints against double booking (staff + resource), concurrency test
- [x] Calendar: day (by staff), week (one person), list (phone default), month counts — own grid, decision 005
- [x] Create / move (drag & drop) / resize / reassign / cancel bookings; multi-service visits back to back; walk-ins
- [x] Statuses + status history (incl. undo of cancel/no-show, no-show counter)
- [x] Realtime updates between admins
- [x] Staff view "My day": now / next / today / upcoming / past, actions, own numbers
- [x] Client card: visit history; dental treatment notes (doctors + owner only, every read audited)
- [ ] Day view by chair/room for dental — chairs are assigned automatically; a chair-column view follows in 3b

### 3b
- [ ] Recurring bookings (every N weeks, X times, conflict list before saving)
- [ ] Waitlist with suggestions when a slot frees up
- [ ] Import existing bookings from CSV/Excel (column mapping, preview, conflict report, no SMS by default)
- [ ] Checkout: payment methods, discounts, daily cash summary
- [ ] Dental: day view by chair/room

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
