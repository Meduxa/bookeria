// Development stand-in for the host's scheduler: calls the SMS job every minute
// while `npm.cmd run dev` is running. Stop with Ctrl+C.
const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/cron/sms`;
const headers: Record<string, string> = process.env.CRON_SECRET
  ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
  : {};

async function tick() {
  try {
    const res = await fetch(url, { headers });
    const body = await res.text();
    console.log(`${new Date().toLocaleTimeString("en-GB")} ${res.status} ${body}`);
  } catch (e) {
    console.log(
      `${new Date().toLocaleTimeString("en-GB")} app not reachable (${e instanceof Error ? e.message : e})`,
    );
  }
}

console.log(`SMS jobs every minute → ${url}`);
await tick();
setInterval(tick, 60_000);
