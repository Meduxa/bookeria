import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "./schema";

export type ClientRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  gender: "female" | "male" | "other" | null;
  source: string | null;
  tags: string[];
  notes: string | null;
  importantNote: string | null;
  preferredStaffId: string | null;
  blockedOnline: boolean;
  noShowCount: number;
  anonymized: boolean;
  createdAt: string;
  consentSms: boolean;
  consentEmail: boolean;
};

// Search by name or phone, newest first. tenantId is server-resolved; RLS also
// limits what staff can see.
export async function listClients(tenantId: string, q: string, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("anonymized_at", null)
    .order("created_at", { ascending: false })
    .order("id") // imports insert many clients at the same instant: keep pages stable
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const term = q
    .trim()
    .replace(/[%,()*\\]/g, " ")
    .trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const parts = [`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (digits.length >= 3) parts.push(`phone_e164.like.%${digits}%`);
    query = query.or(parts.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw new Error("Could not load clients");

  const ids = data.map((c) => c.id);
  const { data: consent } = ids.length
    ? await supabase.from("client_consent_state").select("client_id, channel, granted").in("client_id", ids)
    : { data: [] };
  const granted = new Set((consent ?? []).filter((c) => c.granted).map((c) => `${c.client_id}:${c.channel}`));

  return {
    total: count ?? 0,
    clients: data.map((c): ClientRow => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone_e164,
      email: c.email,
      birthday: c.birthday,
      gender: c.gender as ClientRow["gender"],
      source: c.source,
      tags: c.tags,
      notes: c.notes,
      importantNote: c.important_note,
      preferredStaffId: c.preferred_staff_id,
      blockedOnline: c.blocked_online,
      noShowCount: c.no_show_count,
      anonymized: !!c.anonymized_at,
      createdAt: c.created_at,
      consentSms: granted.has(`${c.id}:sms`),
      consentEmail: granted.has(`${c.id}:email`),
    })),
  };
}

export async function getConsentHistory(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_consents")
    .select("id, channel, granted, source, at")
    .eq("client_id", clientId)
    .order("at", { ascending: false })
    .limit(50);
  return data ?? [];
}
