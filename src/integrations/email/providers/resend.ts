import type { EmailProvider, EmailSendResult, TransactionalEmail } from "../types";

// Resend (https://resend.com/docs/api-reference/emails/send-email). Server only;
// the API key never reaches the browser. The idempotency key makes a retried
// send deliver one email, not two.
export function resendProvider(opts: { apiKey: string; from: string; fetch?: typeof fetch }): EmailProvider {
  const doFetch = opts.fetch ?? fetch;
  return {
    name: "resend",
    async sendTransactional(email: TransactionalEmail): Promise<EmailSendResult> {
      try {
        const res = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": email.idempotencyKey.slice(0, 256),
          },
          body: JSON.stringify({
            from: opts.from,
            to: [email.to],
            subject: email.subject,
            text: email.text,
            ...(email.html ? { html: email.html } : {}),
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { id?: string };
          return { ok: true, providerRef: body.id };
        }
        // 429 and 5xx are temporary; 4xx (bad address, unverified domain) are not
        return {
          ok: false,
          error: {
            code: `http_${res.status}`,
            message: "email not sent",
            retryable: res.status === 429 || res.status >= 500,
          },
        };
      } catch {
        return { ok: false, error: { code: "network", message: "email not sent", retryable: true } };
      }
    },
  };
}
