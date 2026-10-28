# 017 — Landing page inside the app, not Webflow

**Context.** The roadmap planned a Webflow landing page. Levan chose to build it next (2026-10-28); there is no Webflow account, design or copy yet.

**Decision.**
- The landing page is the app's home route `/[locale]` (bookeria.ge → `/ka`): same design tokens and logo, ka/en/ru from the message files, no second tool or account. Signed-in people are sent to their dashboard.
- Screenshots are real app screens from the demo data (`npm.cmd run landing:shots`, one set per language) — retake them after UI changes.
- Prices come from the `plans` table Levan edits at `/admin/plans`; they appear only when every offered plan has a price, until then the page says "14 days free, prices soon".
- Texts promise only what the app does today (checked: trial length, import without SMS, reminder language, EU storage).

**Consequence.** Marketing changes are code changes (a message edit). If a marketing person needs to edit freely later, the page can move to Webflow and the app keep `/login` and `/signup`.
