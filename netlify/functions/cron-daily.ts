import { runJob } from "../lib/cron-job";

// Netlify scheduled function: the daily job (trials ending, deletions due,
// monthly SMS) at 23:30 UTC = 03:30 in Tbilisi, when nobody is booking.
export default function cronDaily(_req: Request, context: { site?: { url?: string } }) {
  return runJob("daily", context);
}

export const config = { schedule: "30 23 * * *" };
