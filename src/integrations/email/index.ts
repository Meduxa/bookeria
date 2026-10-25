import "server-only";
import { serverEnv } from "@/lib/server-env";
import { fakeEmailProvider } from "./providers/fake";
import type { EmailProvider } from "./types";

export function getEmailProvider(): EmailProvider {
  switch (serverEnv().EMAIL_PROVIDER) {
    case "fake":
      return fakeEmailProvider;
  }
}

export type { EmailProvider, TransactionalEmail } from "./types";
