import { enqueueDueReminders } from "@/features/sms/booking-sms";
import { processQueue } from "@/features/sms/send";
import { cronAllowed } from "@/lib/cron-auth";

// Every minute: queue due reminders, then send what is due. Called by the
// host's scheduler in production and by `npm.cmd run jobs` on a developer's computer.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAllowed(req)) return new Response(null, { status: 401 });
  const reminders = await enqueueDueReminders();
  const sent = await processQueue();
  return Response.json({ ...reminders, ...sent });
}
