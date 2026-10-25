import { z } from "zod";
import { emailField } from "@/features/auth/schema";

export const inviteRoles = ["admin", "staff"] as const;

export const inviteSchema = z.object({
  email: emailField,
  role: z.enum(inviteRoles, "required"),
});

export type InviteInput = z.input<typeof inviteSchema>;
