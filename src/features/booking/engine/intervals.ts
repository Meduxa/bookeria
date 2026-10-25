// Interval math on absolute instants (epoch milliseconds). Ranges are
// half-open: [start, end). Pure functions only.

export type Range = readonly [number, number];

export const MIN = 60_000;

export function merge(ranges: readonly Range[]): Range[] {
  const sorted = ranges.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = out.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

export function intersect(a: readonly Range[], b: readonly Range[]): Range[] {
  const out: Range[] = [];
  for (const [as, ae] of merge(a)) {
    for (const [bs, be] of merge(b)) {
      const s = Math.max(as, bs);
      const e = Math.min(ae, be);
      if (e > s) out.push([s, e]);
    }
  }
  return merge(out);
}

export function subtract(from: readonly Range[], remove: readonly Range[]): Range[] {
  let result = merge(from);
  for (const [rs, re] of merge(remove)) {
    result = result.flatMap(([s, e]): Range[] => {
      if (re <= s || rs >= e) return [[s, e]];
      const parts: Range[] = [];
      if (rs > s) parts.push([s, rs]);
      if (re < e) parts.push([re, e]);
      return parts;
    });
  }
  return result;
}

export const overlaps = (a: Range, b: Range) => a[0] < b[1] && b[0] < a[1];

export const contains = (outer: Range, inner: Range) => outer[0] <= inner[0] && inner[1] <= outer[1];

export const overlapsAny = (r: Range, list: readonly Range[]) => list.some((x) => overlaps(r, x));
