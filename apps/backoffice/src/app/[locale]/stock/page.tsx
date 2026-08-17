import { isLocale } from "@mandys/i18n";
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

  return <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8"><header className="mb-8 border-b border-[var(--mandys-border)] pb-6"><Link href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]">← {c.back}</Link><div className="mt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">Mandy&apos;s Stock</p><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{c.title}</h1></div></header><StockBoard locale={locale} /></main>;
}
