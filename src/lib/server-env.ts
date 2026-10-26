import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  EMAIL_PROVIDER: z.enum(["fake"]).default("fake"),
  SMS_PROVIDER: z.enum(["fake"]).default("fake"),
});

let cached: z.infer<typeof serverSchema> | undefined;

// Read lazily so a missing secret fails the request that needs it, not the build.
export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || undefined,
    SMS_PROVIDER: process.env.SMS_PROVIDER || undefined,
  });
  return cached;
}
