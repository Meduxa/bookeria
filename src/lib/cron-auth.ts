import "server-only";
import { timingSafeEqual } from "node:crypto";

// Background job routes are called by the host's scheduler with
// "Authorization: Bearer CRON_SECRET". Without a secret they only run locally.
export function cronAllowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
