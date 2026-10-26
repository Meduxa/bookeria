import { timingSafeEqual } from "node:crypto";
import { enqueueDueReminders } from "@/features/sms/booking-sms";
import { processQueue } from "@/features/sms/send";

// Every minute: queue due reminders, then send what is due. Called by the
// host's scheduler in production (Authorization: Bearer CRON_SECRET) and by
// `npm.cmd run jobs` on a developer's computer.
export const dynamic = "force-dynamic";

function allowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // local development only
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!allowed(req)) return new Response(null, { status: 401 });
  const reminders = await enqueueDueReminders();
  const sent = await processQueue();
  return Response.json({ ...reminders, ...sent });
}
