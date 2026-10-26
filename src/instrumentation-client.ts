import { sentryEnabled, sentryOptions } from "@/lib/sentry-options";

// Browser error reports (Sentry), only when NEXT_PUBLIC_SENTRY_DSN is set; the
// library is loaded only then, so it costs nothing while switched off.
if (sentryEnabled) void import("@sentry/nextjs").then((Sentry) => Sentry.init(sentryOptions));
