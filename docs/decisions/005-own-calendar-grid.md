# 005 — Own calendar grid instead of a calendar library

**Context.** The calendar needs staff (or chairs) as columns, Georgian dates, our design tokens, drag & drop with server validation, and a phone list view. The good "resource" calendar libraries charge licence fees for the staff-as-columns view; the free ones are hard to localise and style, and still need custom work on phones.

**Decision.** Build our own grid (`src/features/booking/components/time-grid.tsx`): absolutely positioned booking blocks over a time axis, pointer-event drag/resize (mouse only, so touch scrolling keeps working), day and week share the same component. Dates are formatted from our own month names (`src/lib/dates.ts`, `messages/*.json`), not the browser's locale data.

**Consequence.** No licence cost or dependency risk; full control over Georgian text and design. We maintain the drag/resize code ourselves (covered by e2e tests). Overlapping blocks never need a layout algorithm because the database forbids overlaps per person.
