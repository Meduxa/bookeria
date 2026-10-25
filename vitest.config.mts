import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      {
        // Runs against the linked Supabase dev project (needs .env.local).
        extends: true,
        test: {
          name: "rls",
          include: ["supabase/tests/**/*.test.ts"],
          environment: "node",
          setupFiles: ["supabase/tests/setup-env.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
