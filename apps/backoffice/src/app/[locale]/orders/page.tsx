import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrdersBoard } from "./orders-board";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Pedidos takeaway" },
  "pt-BR": { back: "Voltar ao painel", title: "Pedidos takeaway" },
  en: { back: "Back to dashboard", title: "Takeaway orders" },
  es: { back: "Volver al panel", title: "Pedidos takeaway" },
} as const;

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];
  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's Orders"
        title={c.title}
      />
      <OrdersBoard locale={locale} />
    </PageShell>
  );
}
