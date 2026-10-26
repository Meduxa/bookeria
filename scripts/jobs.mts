// Development stand-in for the host's scheduler while `npm.cmd run dev` runs:
// the SMS job every minute, the daily job (trials, deletions) at start and every 24 h.
// Stop with Ctrl+C.
const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const headers: Record<string, string> = process.env.CRON_SECRET
  ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
  : {};

async function call(path: string) {
  const time = new Date().toLocaleTimeString("en-GB");
  try {
    const res = await fetch(`${base}${path}`, { headers });
    console.log(`${time} ${path} ${res.status} ${await res.text()}`);
  } catch (e) {
    console.log(`${time} ${path} app not reachable (${e instanceof Error ? e.message : e})`);
  }
}

console.log(`Jobs → ${base}: /api/cron/sms every minute, /api/cron/daily every 24 h`);
await call("/api/cron/daily");
await call("/api/cron/sms");
setInterval(() => call("/api/cron/sms"), 60_000);
setInterval(() => call("/api/cron/daily"), 86_400_000);
