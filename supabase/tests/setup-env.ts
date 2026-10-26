import { config } from "dotenv";
import { assertDevProject } from "../../scripts/dev-project.mts";

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
// the tests create and delete businesses and users: never against production
assertDevProject(process.env.NEXT_PUBLIC_SUPABASE_URL, "The database tests");
