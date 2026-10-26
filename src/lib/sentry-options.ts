import type { ErrorEvent } from "@sentry/nextjs";

// Error reports only, and nothing personal in them: no cookies, headers, request
// bodies, user identity or console output (which could hold client names or
// phone numbers). Used by the browser and the server (decision 011).
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeBreadcrumb: (b: { category?: string }) => (b.category === "console" ? null : b),
  beforeSend(event: ErrorEvent) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.data;
      delete event.request.query_string;
    }
    delete event.user;
    return event;
  },
};

export const sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN;
