import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventsBoardV2 } from "./events-board-v2";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Eventos e grupos" },
  "pt-BR": { back: "Voltar ao painel", title: "Eventos e grupos" },
  en: { back: "Back to dashboard", title: "Events & groups" },
  es: { back: "Volver al panel", title: "Eventos y grupos" },
} as const;

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's Events"
        title={c.title}
      />
      <EventsBoardV2 locale={locale} />
    </PageShell>
  );
}
