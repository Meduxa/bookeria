# 001 — Next.js Cache Components switched off

**Context.** Next.js 16.4 turns on `cacheComponents` in new projects. It prerenders a static shell and requires every cookie/session read to sit behind `<Suspense>`. Almost every Bookeria page depends on the signed-in user and the active tenant.

**Decision.** `cacheComponents: false` in `next.config.ts`. Pages render per request; caching is explicit where we want it.

**Consequence.** Simpler auth and tenant code, no risk of one tenant's data landing in a shared cache. Revisit for the public booking page (Phase 4), which is the one place static prerendering would pay off.
