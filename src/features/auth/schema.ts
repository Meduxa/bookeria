import { z } from "zod";

// Messages are i18n keys under "errors".
export const emailField = z.string().trim().toLowerCase().pipe(z.email("email"));

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "required"),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "nameMin").max(120, "tooLong"),
  email: emailField,
  password: z.string().min(8, "passwordMin").max(72, "tooLong"),
});

export type SignInInput = z.input<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;

// Only same-site relative paths, so a crafted ?next= cannot send users elsewhere.
export function safeNext(next: unknown, fallback: string): string {
  return typeof next === "string" && /^\/(?!\/)[\w\-/.?=&%]*$/.test(next) && !next.includes("\\")
    ? next
    : fallback;
}
