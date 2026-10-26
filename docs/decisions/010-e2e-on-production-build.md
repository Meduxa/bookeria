# 010 — End-to-end tests run against a production build

**Context.** With 61 end-to-end tests, runs against the development server took ~4 minutes and 1–3 different tests failed per run (2026-10-26): the dev server compiles pages on demand, and with three browsers in parallel, simple pages took 2–3 s and sign-ins 5–8 s, so steps passed their time limits. The features themselves were fine.

**Decision.** `npm.cmd run test:e2e` now builds the app and runs the tests against `next start` on port 3100 (`playwright.prod.config.ts`), with the fake SMS provider explicitly allowed (`ALLOW_FAKE_SMS=1`) and a throwaway `CRON_SECRET` for the job routes. `npm.cmd run test:e2e:dev` keeps the quick run against the running dev server.

**Consequence.** Runs take ~1.5 minutes plus ~1 minute to build and were stable (61/61, several runs in a row). Every phase now also proves the production build compiles. Two real bugs surfaced while investigating (a test that matched "31 clients" as "1 client", and dashboard numbers that could show revenue to an admin for up to a minute after the owner switched it off — fixed).
