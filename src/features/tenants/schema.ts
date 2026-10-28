import { z } from "zod";
import { RESERVED_SLUGS } from "@/lib/site";
import { SLUG_PATTERN } from "@/lib/slug";

export const businessTypes = ["salon", "dental"] as const;

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "nameMin").max(120, "tooLong"),
  type: z.enum(businessTypes, "required"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "slugInvalid")
    .refine((s) => !RESERVED_SLUGS.has(s), "slugTaken"),
});

export type CreateBusinessInput = z.input<typeof createBusinessSchema>;
