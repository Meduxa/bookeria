# 003 — Staff invitations through our own table, not Supabase invite emails

**Context.** Supabase's `inviteUserByEmail` only works for people without an account, and its built-in mailer only delivers to the project team's own addresses and a few emails per hour. A stylist may already have an account (works in two salons).

**Decision.** `invitations` table with a random 32-byte token; only its SHA-256 is stored. Owner/admin create invites via RPC; the invited person opens `/invite/<token>`, signs up or signs in with the invited email, and accepts (RPC checks the email matches). Invites expire after 7 days and can be revoked. The email goes through our `integrations/email` adapter; in development the fake provider prints it to the server console and the team page shows the link to copy.

**Consequence.** Works for new and existing users. Real sending needs a transactional email provider (also needed for sign-up confirmation emails in production) — to be chosen before the pilot.
