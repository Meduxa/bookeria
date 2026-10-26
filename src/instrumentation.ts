import * as Sentry from "@sentry/nextjs";
import { sentryEnabled, sentryOptions } from "@/lib/sentry-options";

// Server-side error reports (Sentry), only when NEXT_PUBLIC_SENTRY_DSN is set.
export function register() {
  if (sentryEnabled) Sentry.init(sentryOptions);
}

export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (sentryEnabled) Sentry.captureRequestError(...args);
};
