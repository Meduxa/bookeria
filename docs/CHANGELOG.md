# Changelog

All notable changes per phase. Newest on top.

## Phase 1 — Services, staff, clients + design foundation (2026-10-26)

- **Design**: light and dark theme from Levan's references (green main colour, grouped sidebar, status pills, number cards, details panel sliding in from the right, filter tabs with counts); colour contrast checked; Inter + Noto Sans Georgian; "More" page on phones.
- **Services**: categories (reorder), fixed / "from" / range prices, duration, break after, online/hidden, colour, variants and add-ons; chairs/rooms requirement for dental.
- **Price list import**: paste from a website or Excel, or upload .xlsx/.csv. Recognises category rows and prices like 35, 25-დან, 250–300, 150–200-დან; asks for a duration where the list has none. Tested with two real price lists (20 services in one go).
- **Staff**: profile with photo and calendar colour, link to a login, services with own price/time, weekly schedule with lunch breaks, one-off date changes, time off (in Tbilisi time).
- **Business settings**: contact details, opening hours, closed days, booking rules (notice, how far ahead, cancellation window, time step, approval), what staff can see, chairs/rooms.
- **Clients / patients**: search by name/phone/email, card with important-note warning, tags, preferred staff, block online booking; marketing consent per channel with dated history; merge duplicates; owner can download a client's data or delete personal data; client import with column recognition in ka/en/ru and duplicate checks.
- **Security**: 16 new tables, all with forced RLS and links that cannot cross businesses; 136 isolation tests in total. Atomic database functions for schedules, staff services, opening hours, imports, merge, export, anonymise.
- **Demo data**: both demo businesses now have services (incl. the spec's examples), staff with schedules, 30 clients each, chairs for the clinic.
- Fixed during the phase: a client-import bug that could attach consent to the wrong client; prices showed "GEL 55" in browsers without Georgian locale data; a browser component importing server-only code.

## Phase 0 — Foundation (2026-10-25)

- Next.js 16 (App Router, strict TypeScript), Tailwind 4, shadcn/ui, lucide icons; `APP_NAME` in `src/lib/app.ts`.
- Georgian / English / Russian with next-intl. The app always opens in Georgian; a language switcher is on every page. A test keeps the three translation files in sync.
- Supabase dev project `bookeria-dev` in Frankfurt. First migration: businesses (tenants), profiles, memberships (owner / admin / staff), invitations, audit log. Row Level Security on and forced on every table; writes that span tables go through checked database functions.
- 32 tenant-isolation tests prove a user of business A cannot see or change anything of business B, staff cannot do owner/admin actions, anonymous visitors see nothing, and a business can be deleted cleanly.
- Sign-up, sign-in, sign-out; create a business (salon or dental clinic) with an auto-generated booking address (Georgian names are transliterated); invite staff by link (email goes through the email adapter — fake provider for now); accept invitation; switch between businesses.
- Dashboard shell: sidebar on desktop, bottom navigation on phones, "Patients" instead of "Clients" for dental clinics, placeholder pages for Calendar / Clients / Services, onboarding checklist.
- Helpers with tests: phone numbers to E.164 (+995), money as integer tetri, slugs.
- Demo data: "სალონი ნინო" and "დენტალ სმაილი" with owner, administrator and staff each.
- Fixed during the phase: business deletion was blocked by the membership audit trigger; emails typed with spaces were rejected; avatar initials turned Georgian letters into Mtavruli capitals; invite email no longer travels in the URL; auth pages now have a real page heading.
- Decisions: 001 Cache Components off, 002 cloud dev database instead of Docker, 003 own invitations table.

## [Unreleased]
- Project brief, rules, specification, roadmap and Claude Code skills created.
