export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
};

export type EmailSendResult = {
  ok: boolean;
  providerRef?: string;
  error?: { code: string; message: string; retryable: boolean };
};

// Marketing methods (contacts, campaigns, webhooks) are added in Phase 7.
export interface EmailProvider {
  name: string;
  sendTransactional(email: TransactionalEmail): Promise<EmailSendResult>;
}
