import "server-only";
import { hmac } from "@/features/public-booking/security";
import { publicEnv } from "@/lib/env";

// Unsubscribe links in promotional SMS: /u/<client id, 22 chars><signature, 10 chars>.
// Short (every character costs in Georgian SMS) and cannot be guessed or forged.

const toB64 = (uuid: string) => Buffer.from(uuid.replace(/-/g, ""), "hex").toString("base64url");
const fromB64 = (s: string) => {
  const hex = Buffer.from(s, "base64url").toString("hex");
  return hex.length === 32
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : null;
};
const sign = (clientId: string) =>
  Buffer.from(hmac(`unsub:${clientId}`), "hex")
    .toString("base64url")
    .slice(0, 10);

export const unsubscribeLink = (clientId: string) =>
  `${publicEnv.NEXT_PUBLIC_APP_URL}/u/${toB64(clientId)}${sign(clientId)}`;

/** The client id, or null when the key is wrong. */
export function readUnsubscribeKey(key: string): string | null {
  if (!/^[A-Za-z0-9_-]{32}$/.test(key)) return null;
  const id = fromB64(key.slice(0, 22));
  return id && sign(id) === key.slice(22) ? id : null;
}
