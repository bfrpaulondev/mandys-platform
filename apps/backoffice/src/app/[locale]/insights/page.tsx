import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InsightsBoard } from "./insights-board";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Insights" },
  "pt-BR": { back: "Voltar ao painel", title: "Insights" },
  en: { back: "Back to dashboard", title: "Insights" },
  es: { back: "Volver al panel", title: "Insights" },
} as const;

export default async function InsightsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];
  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's Insights"
        title={c.title}
      />
      <InsightsBoard locale={locale} />
    </PageShell>
  );
}
