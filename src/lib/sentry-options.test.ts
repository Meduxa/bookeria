import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-options";

describe("sentry options", () => {
  it("removes everything personal before a report leaves the app", () => {
    const event = sentryOptions.beforeSend({
      type: undefined,
      request: {
        url: "https://x/ka/clients",
        cookies: { a: "b" },
        headers: { cookie: "c" },
        data: '{"phone":"+99555"}',
        query_string: "q=599",
      },
      user: { email: "owner@example.test" },
    } as never);
    expect(event.request).toEqual({ url: "https://x/ka/clients" });
    expect(event.user).toBeUndefined();
    expect(sentryOptions.sendDefaultPii).toBe(false);
  });
  it("drops console breadcrumbs, keeps others", () => {
    expect(sentryOptions.beforeBreadcrumb({ category: "console" })).toBeNull();
    expect(sentryOptions.beforeBreadcrumb({ category: "navigation" })).toEqual({ category: "navigation" });
  });
});
