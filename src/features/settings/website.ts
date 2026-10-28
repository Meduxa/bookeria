import { z } from "zod";

export const SITE_THEMES = ["emerald", "rose", "plum", "ocean", "amber"] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];

// Owners paste a handle or a whole profile link; we keep only the handle.
// Returns null for empty input and undefined when it isn't a valid handle.
export function socialHandle(input: string, network: "instagram" | "facebook"): string | null | undefined {
  let v = input.trim();
  if (!v) return null;
  const host = network === "instagram" ? "instagram\\.com" : "(?:facebook|fb)\\.com";
  const m = v.match(new RegExp(`^(?:https?://)?(?:www\\.|m\\.)?${host}/([^/?#]+)`, "i"));
  if (m) v = m[1]!;
  v = v.replace(/^@/, "");
  const ok = network === "instagram" ? /^[A-Za-z0-9._]{1,30}$/ : /^[A-Za-z0-9.-]{1,80}$/;
  return ok.test(v) ? v : undefined;
}

export const websiteSchema = z.object({
  about: z.object({
    ka: z.string().trim().max(1000),
    en: z.string().trim().max(1000),
    ru: z.string().trim().max(1000),
  }),
  instagram: z.string().max(200),
  facebook: z.string().max(200),
  theme: z.enum(SITE_THEMES),
});
export type WebsiteInput = z.infer<typeof websiteSchema>;

export const imagePath = (tenantId: string) =>
  z
    .string()
    .regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/)
    .refine((p) => p.startsWith(`${tenantId}/`));
