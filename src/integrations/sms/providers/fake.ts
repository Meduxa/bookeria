import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SmsProvider, SmsSendInput } from "../types";

// Development and tests: never sends. Prints the message in the dev server
// window and appends it to .dev/sms-outbox.jsonl, where end-to-end tests read
// SMS codes. Refuses to run in production (see ../index.ts).
const sent = new Set<string>();
const outbox = join(process.cwd(), ".dev", "sms-outbox.jsonl");

export const fakeSmsProvider: SmsProvider = {
  name: "fake",
  async send(sms: SmsSendInput) {
    if (!sent.has(sms.idempotencyKey)) {
      sent.add(sms.idempotencyKey);
      console.info(`[sms:fake] to=${sms.to}\n${sms.text}`);
      mkdirSync(join(process.cwd(), ".dev"), { recursive: true });
      appendFileSync(
        outbox,
        JSON.stringify({ to: sms.to, text: sms.text, at: new Date().toISOString() }) + "\n",
      );
    }
    return { ok: true, providerRef: `fake-${sms.idempotencyKey}`, segments: 1 };
  },
};
