import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerBoard } from "./customer-board";

const copy = {
  "pt-PT": { back: "Voltar ao painel", eyebrow: "Mandy's CRM", title: "Clientes", subtitle: "Histórico, contactos, preferências e contexto de cada cliente do restaurante." },
  "pt-BR": { back: "Voltar ao painel", eyebrow: "Mandy's CRM", title: "Clientes", subtitle: "Histórico, contatos, preferências e contexto de cada cliente do restaurante." },
  en: { back: "Back to dashboard", eyebrow: "Mandy's CRM", title: "Customers", subtitle: "History, contacts, preferences and context for each restaurant customer." },
  es: { back: "Volver al panel", eyebrow: "Mandy's CRM", title: "Clientes", subtitle: "Historial, contactos, preferencias y contexto de cada cliente del restaurante." },
} as const;

export default async function CustomersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = copy[locale];
  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
      />
      <CustomerBoard locale={locale} />
    </PageShell>
  );
}
