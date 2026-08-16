import { isLocale, localeLabels, locales, type Locale } from "@mandys/i18n";
import { toCssVariables } from "@mandys/theme-core";
import { minimalTheme } from "@mandys/theme-minimal";
import { Button } from "@mandys/ui";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

const copy = {
  "pt-PT": {
    eyebrow: "Mandy's Minimal · Demo",
    title: "Produto fresco. Cozinha simples. Setúbal à mesa.",
    lead: "Uma demonstração de restaurante criada para mostrar menu administrável, reservas diretas e uma experiência multilíngue.",
    reserve: "Reservar mesa",
    menu: "Ver menu",
    section: "Hoje no menu",
    starter: "Ostras da costa",
    starterDescription: "Limão, ervas frescas e azeite.",
    main: "Choco frito",
    mainDescription: "Batata, salada e molho da casa.",
    dessert: "Tarte de limão",
    dessertDescription: "Merengue leve e citrinos.",
    bookingTitle: "Reserve diretamente",
    bookingText: "Escolha data, hora e número de pessoas. Sem depender de plataformas externas.",
    guests: "4 pessoas",
    time: "20:30",
  },
  "pt-BR": {
    eyebrow: "Mandy's Minimal · Demo",
    title: "Produto fresco. Cozinha simples. Setúbal à mesa.",
    lead: "Uma demonstração de restaurante criada para mostrar cardápio administrável, reservas diretas e uma experiência multilíngue.",
    reserve: "Reservar mesa",
    menu: "Ver cardápio",
    section: "Hoje no cardápio",
    starter: "Ostras da costa",
    starterDescription: "Limão, ervas frescas e azeite.",
    main: "Choco frito",
    mainDescription: "Batata, salada e molho da casa.",
    dessert: "Torta de limão",
    dessertDescription: "Merengue leve e cítricos.",
    bookingTitle: "Reserve diretamente",
    bookingText: "Escolha data, horário e número de pessoas. Sem depender de plataformas externas.",
    guests: "4 pessoas",
    time: "20:30",
  },
  en: {
    eyebrow: "Mandy's Minimal · Demo",
    title: "Fresh produce. Simple cooking. Setúbal at the table.",
    lead: "A restaurant demo showing an editable menu, direct reservations and a multilingual guest experience.",
    reserve: "Book a table",
    menu: "View menu",
    section: "On today's menu",
    starter: "Local oysters",
    starterDescription: "Lemon, fresh herbs and olive oil.",
    main: "Fried cuttlefish",
    mainDescription: "Potatoes, salad and house sauce.",
    dessert: "Lemon tart",
    dessertDescription: "Light meringue and citrus.",
    bookingTitle: "Book directly",
    bookingText: "Choose a date, time and party size without depending on external platforms.",
    guests: "4 guests",
    time: "20:30",
  },
  es: {
    eyebrow: "Mandy's Minimal · Demo",
    title: "Producto fresco. Cocina sencilla. Setúbal en la mesa.",
    lead: "Una demo de restaurante con carta editable, reservas directas y una experiencia multilingüe.",
    reserve: "Reservar mesa",
    menu: "Ver carta",
    section: "Hoy en la carta",
    starter: "Ostras de la costa",
    starterDescription: "Limón, hierbas frescas y aceite de oliva.",
    main: "Sepia frita",
    mainDescription: "Patatas, ensalada y salsa de la casa.",
    dessert: "Tarta de limón",
    dessertDescription: "Merengue ligero y cítricos.",
    bookingTitle: "Reserva directamente",
    bookingText: "Elige fecha, hora y número de personas sin depender de plataformas externas.",
    guests: "4 personas",
    time: "20:30",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const themeStyle = toCssVariables(minimalTheme.tokens) as CSSProperties;

export default async function RestaurantDemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <main style={themeStyle} className="min-h-screen bg-[var(--mandys-background)] text-[var(--mandys-foreground)]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href={`/${locale}`} className="text-lg font-semibold tracking-[-0.04em]">Maré</a>
        <div className="flex items-center gap-3">
          <details className="relative text-sm">
            <summary className="cursor-pointer list-none text-[var(--mandys-foreground-muted)]">{localeLabels[locale]}</summary>
            <div className="absolute right-0 z-10 mt-3 min-w-48 rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-2 shadow-lg">
              {locales.map((item) => (
                <a key={item} href={`/${item}`} className="block rounded-md px-3 py-2 hover:bg-[var(--mandys-surface-muted)]">
                  {localeLabels[item]}
                </a>
              ))}
            </div>
          </details>
          <Button>{c.reserve}</Button>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mandys-accent)]">{c.eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">{c.title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--mandys-foreground-muted)] sm:text-lg">{c.lead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg">{c.reserve}</Button>
            <Button size="lg" variant="secondary">{c.menu}</Button>
          </div>
        </div>

        <aside className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 shadow-[var(--mandys-shadow-sm)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{c.bookingTitle}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.bookingText}</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-surface-muted)] p-4">
              <p className="text-xs text-[var(--mandys-foreground-muted)]">17 Aug</p>
              <p className="mt-1 font-medium">{c.time}</p>
            </div>
            <div className="rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-surface-muted)] p-4">
              <p className="text-xs text-[var(--mandys-foreground-muted)]">Party</p>
              <p className="mt-1 font-medium">{c.guests}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="border-t border-[var(--mandys-border)] bg-[var(--mandys-surface)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <h2 className="text-3xl font-semibold tracking-[-0.04em]">{c.section}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [c.starter, c.starterDescription, "€14"],
              [c.main, c.mainDescription, "€18"],
              [c.dessert, c.dessertDescription, "€7"],
            ].map(([name, description, price]) => (
              <article key={name} className="border-t border-[var(--mandys-border)] py-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium">{name}</h3>
                  <span className="text-sm font-medium">{price}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
