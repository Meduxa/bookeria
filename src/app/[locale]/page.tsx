import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const user = await getCurrentUser();
  redirect(`/${locale}/${user ? "dashboard" : "login"}`);
}
