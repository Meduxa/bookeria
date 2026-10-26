# Performance baseline (Phase 6b, 2026-10-26)

Production build (`next build && next start`) on Levan's laptop, database in Frankfurt, phone-size browser, one person at a time, median of 3 loads.

| Page | Full load | JavaScript (compressed) |
|---|---|---|
| Sign-in | 0.11 s | 258 KB |
| Public booking page | 0.41 s | 223 KB |
| Dashboard | 0.46 s | 214 KB |
| Calendar | 0.81 s | 345 KB |
| Clients | 0.65 s | 336 KB |
| Services | 0.44 s | 279 KB |
| Reports | 0.70 s | 214 KB |
| Settings → Business | 0.49 s | 380 KB |

Calendar day with 15 staff × 150 bookings: ~340 ms for the data (Phase 3b test `perf_calendar`).

Notes
- The large phone-number library (`libphonenumber-js/max`) reaches the browser only on the three import pages that need it.
- The development server is several times slower and not representative (decision 010).
- Re-measure on Netlify after deployment: the server will sit next to the database (Frankfurt), but every page then travels from Frankfurt to Georgia.
