import { isLocale, locales, type Locale } from "@mandys/i18n";
import { ToastProvider } from "@mandys/ui";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BackofficeCacheBoundary } from "./backoffice-cache-boundary";
import { SessionBoundary } from "./session-boundary";

export function generateStaticParams(): Array<{ locale: Locale }> { return locales.map((locale) => ({ locale })); }

export default async function LocaleLayout({ children, params }: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BackofficeCacheBoundary><ToastProvider><SessionBoundary locale={locale}>{children}</SessionBoundary></ToastProvider></BackofficeCacheBoundary>;
}
