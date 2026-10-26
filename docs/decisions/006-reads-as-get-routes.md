# 006 — Panel data loads through GET routes, not server actions

**Context.** Next.js runs a page's server actions one at a time. Panels that load data when they open (client visits, consent history, booking history, booking payments) were server actions, so a button pressed right after opening a panel ("arrived", "view notes") queued behind them. With a busy server this took 15+ seconds and made two end-to-end tests hang now and then; real users would feel it as slow buttons.

**Decision.** Read-only panel loaders live in `src/features/booking/reads.ts` (server-only) and are served by one route, `GET /api/read/[name]/[id]`, called from the browser with `read()` from `src/lib/read.ts`. Each loader checks sign-in and the active business exactly like the actions did, and RLS applies. Everything that changes data — and the audited dental-notes read — stays a server action.

**Consequence.** Loads run in parallel and never hold up a button. `app/api` now holds webhooks and this one read route. A new panel loader is added to `READS`; anything that writes must not go there.
