import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Off on purpose: almost every page depends on the signed-in user and
  // tenant, so there is nothing to prerender. See docs/decisions/001.
  cacheComponents: false,
  // Dev logging prints server action arguments in plain text — that includes
  // passwords and clients' personal data. Never log them.
  logging: { serverFunctions: false },
  async headers() {
    // the service worker must always be fetched fresh, or app updates would hang on old code
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
