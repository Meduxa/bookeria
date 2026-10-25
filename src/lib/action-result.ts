// Server actions return an error *code*; the form translates it with next-intl.
// Raw database errors never reach the browser.
export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; field?: string };

export const fail = (error: string, field?: string): ActionResult<never> => ({ ok: false, error, field });
export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
