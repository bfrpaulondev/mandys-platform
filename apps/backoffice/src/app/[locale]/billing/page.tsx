import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BillingBoard } from "./billing-board";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Plano e subscrição" },
  "pt-BR": { back: "Voltar ao painel", title: "Plano e assinatura" },
  en: { back: "Back to dashboard", title: "Plan & subscription" },
  es: { back: "Volver al panel", title: "Plan y suscripción" },
} as const;

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];
  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's SaaS Core"
        title={c.title}
      />
      <BillingBoard locale={locale} />
    </PageShell>
  );
}
