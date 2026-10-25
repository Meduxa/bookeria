import { getTranslations, setRequestLocale } from "next-intl/server";
import { StaffList } from "@/features/staff/components/staff-list";
import { getStaffList } from "@/features/staff/queries";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/staff">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "staff" });
  return { title: t("title") };
}

export default async function StaffPage({ params }: PageProps<"/[locale]/staff">) {
  setRequestLocale((await params).locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const staff = await getStaffList(tenant.tenantId);
  return <StaffList staff={staff} canManage={canManage(tenant.role)} isDental={tenant.type === "dental"} />;
}
