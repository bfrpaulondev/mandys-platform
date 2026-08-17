import { isLocale } from "@mandys/i18n";
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
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-[var(--mandys-border)] pb-6">
        <Link href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]">← {c.back}</Link>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{c.eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{c.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
      </header>
      <CustomerBoard locale={locale} />
    </main>
  );
}
