import { cronAllowed } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Once a day: trials that ended become "payment due"; businesses whose 14-day
// deletion period is over are removed.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAllowed(req)) return new Response(null, { status: 401 });
  const db = createAdminClient();
  const [trials, purged] = await Promise.all([db.rpc("expire_trials"), db.rpc("purge_due_tenants")]);
  if (trials.error || purged.error) return Response.json({ error: "job failed" }, { status: 500 });
  return Response.json({ trialsEnded: trials.data, businessesDeleted: purged.data });
}
