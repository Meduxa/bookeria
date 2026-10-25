import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientsView } from "@/features/clients/components/clients-view";
import { listClients } from "@/features/clients/queries";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/clients">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "clients" });
  return { title: t("title") };
}

export default async function ClientsPage({ params, searchParams }: PageProps<"/[locale]/clients">) {
  setRequestLocale((await params).locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const page = Math.max(0, Math.min(10_000, Number(sp.page) || 0));

  const supabase = await createClient();
  const { data: tz } = await supabase.from("tenants").select("timezone").eq("id", tenant.tenantId).single();
  const [{ clients, total }, { data: staff }] = await Promise.all([
    listClients(tenant.tenantId, q, page),
    supabase
      .from("staff")
      .select("id, display_name")
      .eq("tenant_id", tenant.tenantId)
      .eq("active", true)
      .order("display_name"),
  ]);

  return (
    <ClientsView
      clients={clients}
      total={total}
      q={q}
      page={page}
      staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name }))}
      canManage={canManage(tenant.role)}
      isOwner={tenant.role === "owner"}
      isDental={tenant.type === "dental"}
      timeZone={tz?.timezone ?? DEFAULT_TZ}
    />
  );
}
