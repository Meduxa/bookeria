// The development Supabase project (demo data only). Demo seeding and the
// database tests create and delete data, so they run ONLY against this project —
// never against production, whatever .env.local says. The ref is not a secret.
export const DEV_PROJECT_REF = "cznbcglbskunoofrdeut";

export function assertDevProject(url: string | undefined, what: string) {
  if (!url || !url.includes(`${DEV_PROJECT_REF}.supabase.co`)) {
    throw new Error(
      `${what} runs only against the dev project (${DEV_PROJECT_REF}); this is ${url ?? "not set"}.`,
    );
  }
}
