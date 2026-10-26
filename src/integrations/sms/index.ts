import "server-only";
import { serverEnv } from "@/lib/server-env";
import { fakeSmsProvider } from "./providers/fake";
import type { SmsProvider } from "./types";

export function getSmsProvider(): SmsProvider {
  switch (serverEnv().SMS_PROVIDER) {
    case "fake":
      // a fake provider in production would silently swallow SMS codes
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_SMS !== "1") {
        throw new Error("SMS_PROVIDER=fake is not allowed in production");
      }
      return fakeSmsProvider;
    default:
      throw new Error("SMS_PROVIDER is not configured");
  }
}

export type { SmsProvider, SmsSendInput } from "./types";
