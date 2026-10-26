import type { ReadName, ReadResult } from "@/features/booking/reads";

// Browser side of GET /api/read (decision 006). Unlike server actions these
// run in parallel and never hold up a button. Falls back when anything fails.
export async function read<N extends ReadName>(
  name: N,
  id: string,
  fallback: ReadResult<N>,
): Promise<ReadResult<N>> {
  try {
    const res = await fetch(`/api/read/${name}/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as ReadResult<N>;
  } catch {
    return fallback;
  }
}
