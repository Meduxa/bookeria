import type { EmailProvider, TransactionalEmail } from "../types";

// Development and tests: never sends. Keeps messages in memory and prints a
// short line to the server console so the developer can see what would go out.
const sent = new Map<string, TransactionalEmail>();

export const fakeEmailProvider: EmailProvider = {
  name: "fake",
  async sendTransactional(email) {
    if (!sent.has(email.idempotencyKey)) {
      sent.set(email.idempotencyKey, email);
      console.info(`[email:fake] to=${email.to} subject="${email.subject}"\n${email.text}`);
    }
    return { ok: true, providerRef: `fake-${email.idempotencyKey}` };
  },
};

export const fakeEmailOutbox = () => [...sent.values()];
