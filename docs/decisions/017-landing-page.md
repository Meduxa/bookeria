# 017 — Landing page inside the app, not Webflow

**Context.** The roadmap planned a Webflow landing page. Levan chose to build it next (2026-10-28); there is no Webflow account, design or copy yet.

**Decision.**
- The landing page is the app's home route `/[locale]` (bookeria.ge → `/ka`): same design tokens and logo, ka/en/ru from the message files, no second tool or account. Signed-in people are sent to their dashboard.
- Screenshots are real app screens from the demo data (`npm.cmd run landing:shots`, one set per language) — retake them after UI changes.
- Prices come from the `plans` table Levan edits at `/admin/plans`; they appear only when every offered plan has a price, until then the page says "14 days free, prices soon".
- Texts promise only what the app does today (checked: trial length, import without SMS, reminder language, EU storage).

**Consequence.** Marketing changes are code changes (a message edit). If a marketing person needs to edit freely later, the page can move to Webflow and the app keep `/login` and `/signup`.

**Update 2026-10-29 — prices.** Levan set the first prices, 10 ₾ below the main competitor with the same limits: **Starter** 39 ₾ (1 specialist, 900 SMS), **Standard** 89 ₾ (2–15, 1,500 SMS), **Premium** individual (a card on the page, not a plan row). Prepaying 6 / 12 / 18 months gives −10 / −20 / −30 % (`src/features/landing/pricing.ts`, rounded down to whole lari). Every "Choose plan" button opens the same free sign-up — the plan is agreed when the trial ends. Cards turn green under the mouse. Risk noted: at ~0.04 ₾ per SMS, the included SMS can cost most of the Starter price if a business uses them all.
