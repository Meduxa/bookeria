import { runJob } from "../lib/cron-job";

// Netlify scheduled function: the SMS job every 5 minutes (reminders + sending).
// Login codes and booking confirmations go out at once, not through this job;
// every 5 minutes keeps the Netlify free plan within its monthly credits.
export default function cronSms(_req: Request, context: { site?: { url?: string } }) {
  return runJob("sms", context);
}

export const config = { schedule: "*/5 * * * *" };
