import { READS, type ReadName } from "@/features/booking/reads";

// Parallel read endpoint for browser panels (decision 006). Sign-in and the
// active business are checked inside each loader; RLS does the rest.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/read/[name]/[id]">) {
  const { name, id } = await ctx.params;
  if (!Object.hasOwn(READS, name)) return new Response(null, { status: 404 });
  const data = await READS[name as ReadName](id);
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
