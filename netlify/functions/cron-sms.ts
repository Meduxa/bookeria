// Netlify scheduled function: the SMS job every 5 minutes (reminders + sending).
// Login codes and booking confirmations go out at once, not through this job;
// every 5 minutes keeps the Netlify free plan within its monthly credits.
// It only calls the app's protected job route; the work happens there.
export default async function cronSms() {
  const res = await fetch(`${process.env.URL}/api/cron/sms`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(`sms job: ${res.status}`, { status: res.ok ? 200 : 500 });
}

export const config = { schedule: "*/5 * * * *" };
