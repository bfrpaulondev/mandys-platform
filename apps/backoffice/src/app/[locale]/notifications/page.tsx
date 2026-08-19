import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NotificationsBoard } from "./notifications-board";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Notificações" },
  "pt-BR": { back: "Voltar ao painel", title: "Notificações" },
  en: { back: "Back to dashboard", title: "Notifications" },
  es: { back: "Volver al panel", title: "Notificaciones" },
} as const;

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];
  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]">← {c.back}</Link>}
        eyebrow="Mandy's Core"
        title={c.title}
      />
      <NotificationsBoard locale={locale} />
    </PageShell>
  );
}
