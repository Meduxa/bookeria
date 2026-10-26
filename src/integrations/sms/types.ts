export type SmsSendInput = {
  to: string; // E.164
  text: string;
  senderName?: string;
  idempotencyKey: string;
};

export type SmsSendResult = {
  ok: boolean;
  providerRef?: string;
  segments?: number;
  error?: { code: string; message: string; retryable: boolean };
};

// Delivery reports, balance and sender names are added with the real provider in Phase 5.
export interface SmsProvider {
  name: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}
