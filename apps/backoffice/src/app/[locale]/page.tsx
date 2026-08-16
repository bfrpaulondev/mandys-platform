import { isLocale } from "@mandys/i18n";
import { notFound } from "next/navigation";

import { DashboardLive } from "./dashboard-live";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <DashboardLive locale={locale} />;
}
