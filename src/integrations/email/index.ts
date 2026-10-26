import "server-only";
import { serverEnv } from "@/lib/server-env";
import { fakeEmailProvider } from "./providers/fake";
import { resendProvider } from "./providers/resend";
import type { EmailProvider } from "./types";

export function getEmailProvider(): EmailProvider {
  const env = serverEnv();
  switch (env.EMAIL_PROVIDER) {
    case "fake":
      return fakeEmailProvider;
    case "resend":
      if (!env.EMAIL_API_KEY || !env.EMAIL_FROM)
        throw new Error("EMAIL_API_KEY and EMAIL_FROM are required for Resend");
      return resendProvider({ apiKey: env.EMAIL_API_KEY, from: env.EMAIL_FROM });
    default:
      throw new Error("EMAIL_PROVIDER is not configured");
  }
}

export type { EmailProvider, TransactionalEmail } from "./types";
