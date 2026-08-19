import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StockBoard } from "./stock-board";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Stock e custos" },
  "pt-BR": { back: "Voltar ao painel", title: "Estoque e custos" },
  en: { back: "Back to dashboard", title: "Stock & costs" },
  es: { back: "Volver al panel", title: "Stock y costes" },
} as const;

export default async function StockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's Stock"
        title={c.title}
      />
      <StockBoard locale={locale} />
    </PageShell>
  );
}
