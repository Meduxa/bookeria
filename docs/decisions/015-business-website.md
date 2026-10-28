# 015 — The business website is the booking page

**Context.** Levan wants every customer to get a small, beautiful website where clients book (2026-10-28, after looking at mysalon.ge). Short addresses (`name.bookeria.ge`) come once the domain is registered.

**Decision.**
- No separate site builder: the public booking page `/book/[slug]` *is* the website — cover photo, logo, about text (ka/en/ru, falls back to the first filled-in language), Instagram/Facebook, gallery, team, hours, map, a "Book a visit" button that jumps to the booking card.
- The owner edits it in Settings → "Your website". Settings live in `tenant_settings` (`site_*` columns, same policies); images go to the existing `business-photos` bucket and the database refuses paths outside the business's folder. Social links are stored as handles only, so a link can never point anywhere else.
- Five colour themes (emerald = the app's own, rose, plum, ocean, amber). A theme only changes the brand colours (`--primary`, `--accent`, `--ring`) through `data-site-theme` in `globals.css`; text and surfaces stay ours, and an e2e test runs the contrast check on every theme.
- Booking starts "by service" or "by specialist"; choosing the person first skips the "who" step.
- Shared links show the business's name, about text and cover (Open Graph).

**Consequence.** Every business looks distinct without hand-made design. Custom fonts, layouts or own domains are out of scope for v1. When the short address arrives it only needs to route to this page.
