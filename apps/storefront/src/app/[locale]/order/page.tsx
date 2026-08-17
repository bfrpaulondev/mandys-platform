import { isLocale, type Locale } from "@mandys/i18n";
import { toCssVariables } from "@mandys/theme-core";
import { minimalTheme } from "@mandys/theme-minimal";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { getStorefrontData } from "../../../lib/storefront";
import { OrderForm } from "./order-form";

const copy = {
  "pt-PT": { back: "Voltar ao restaurante", eyebrow: "Takeaway", title: "Peça diretamente ao restaurante.", text: "Escolha no menu, envie o pedido e pague quando levantar. Sem marketplace entre si e o restaurante.", empty: "Ainda não existem itens disponíveis para pedidos online." },
  "pt-BR": { back: "Voltar ao restaurante", eyebrow: "Takeaway", title: "Peça diretamente ao restaurante.", text: "Escolha no cardápio, envie o pedido e pague quando retirar. Sem marketplace entre você e o restaurante.", empty: "Ainda não existem itens disponíveis para pedidos online." },
  en: { back: "Back to restaurant", eyebrow: "Takeaway", title: "Order directly from the restaurant.", text: "Choose from the menu, place your order and pay at pickup. No marketplace between you and the restaurant.", empty: "There are no items available for online ordering yet." },
  es: { back: "Volver al restaurante", eyebrow: "Takeaway", title: "Pide directamente al restaurante.", text: "Elige de la carta, envía el pedido y paga al recoger. Sin marketplace entre tú y el restaurante.", empty: "Todavía no hay artículos disponibles para pedidos online." },
} as const satisfies Record<Locale, Record<string, string>>;

const themeStyle = toCssVariables(minimalTheme.tokens) as CSSProperties;
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const data = await getStorefrontData(rawLocale);
  const locale = data.locale;
  const c = copy[locale];
  const items = data.menus.flatMap((menu) => menu.categories.flatMap((category) => category.items.map((item) => ({ id: item.id, name: item.name, description: item.description, priceCents: item.priceCents, categoryName: category.name }))));

  return (
    <main style={themeStyle} className="min-h-screen bg-[var(--mandys-background)] text-[var(--mandys-foreground)]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href={`/${locale}`} className="text-lg font-semibold tracking-[-0.04em]">{data.restaurant.publicName}</a>
        <a href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]">← {c.back}</a>
      </nav>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">Mandy&apos;s Orders · {c.eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{c.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--mandys-foreground-muted)]">{c.text}</p>
        <div className="mt-10">{items.length > 0 ? <OrderForm locale={locale} currency={data.currency} items={items} /> : <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</div>}</div>
      </section>
    </main>
  );
}
