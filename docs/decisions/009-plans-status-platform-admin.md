# 009 — Plans, account status and the platform admin

**Context.** Levan has no plans or prices yet (2026-10-26) and invoices by hand in v1 (SPEC 4.13). Businesses still need a trial, a way to be suspended, plan limits and an admin area for Levan.

**Decision.**
- Plans live in a `plans` table with placeholder values (Trial unlimited, Start 2 staff, Pro 10, Clinic 10); Levan edits names, prices, staff limits and included SMS at `/admin/plans`. The staff limit is enforced by a database trigger; included SMS are added on the first daily run of each month.
- Status: `trial` → (trial ends, daily job) `past_due` = warning banner only, online booking and reminders keep working; `suspended` / `cancelled` = read-only. Read-only is enforced where every change starts — the server action contexts (`managerContext` / `memberContext` refuse unless an action is marked `{ read: true }`) — plus the public booking functions in the database. Viewing and the full export always work.
- Platform admins are listed in `platform_admins` (added with `npm.cmd run platform-admin -- <email>`, never from the app). Every admin function checks `is_platform_admin()` in the database; `/admin` answers "not found" to everyone else. Admin changes are written to the business's own audit log.
- Business deletion: the owner types the name; the business is purged 14 days later by the daily job unless cancelled.

**Consequence.** Prices can be decided at any time without code changes. Read-only is not a database rule for every table: a new server action that forgets the context helpers would bypass it — new actions must use them (CLAUDE.md §4). Automatic billing comes with the payment gateway (Phase 8).
