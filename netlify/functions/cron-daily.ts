// Netlify scheduled function: the daily job (trials ending, deletions due,
// monthly SMS) at 23:30 UTC = 03:30 in Tbilisi, when nobody is booking.
export default async function cronDaily() {
  const res = await fetch(`${process.env.URL}/api/cron/daily`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(`daily job: ${res.status}`, { status: res.ok ? 200 : 500 });
}

export const config = { schedule: "30 23 * * *" };
