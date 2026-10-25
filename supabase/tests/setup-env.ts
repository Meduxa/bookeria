import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  if (!process.env[name]) {
    throw new Error(`${name} is missing. RLS tests run against the dev project: fill in .env.local first.`);
  }
}
