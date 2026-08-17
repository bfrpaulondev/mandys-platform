import { isLocale, localeLabels, type Locale } from "@mandys/i18n";
import { toCssVariables } from "@mandys/theme-core";
import { minimalTheme } from "@mandys/theme-minimal";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { getStorefrontData } from "../../lib/storefront";
import { ReservationForm } from "./reservation-form";

const copy = {
  "pt-PT": {
    eyebrow: "Cozinha atlântica · Setúbal",
    titleFallback: "Produto fresco. Cozinha simples. Setúbal à mesa.",
    reserve: "Reservar mesa",
    menu: "Ver menu",
    events: "Grupos e eventos",
    menuTitle: "Menu",
    bookingTitle: "Reserve diretamente",
    bookingText: "Escolha data, hora e número de pessoas. O pedido entra diretamente na operação do restaurante.",
    contact: "Contacto",
    hours: "Horário",
    closed: "Fechado",
    demo: "Demonstração Mandy's",
    allergens: "Alergénios",
    noMenu: "O menu ainda não foi publicado.",
  },
  "pt-BR": {
    eyebrow: "Cozinha atlântica · Setúbal",
    titleFallback: "Produto fresco. Cozinha simples. Setúbal à mesa.",
    reserve: "Reservar mesa",
    menu: "Ver cardápio",
    events: "Grupos e eventos",
    menuTitle: "Cardápio",
    bookingTitle: "Reserve diretamente",
    bookingText: "Escolha data, horário e número de pessoas. O pedido entra diretamente na operação do restaurante.",
    contact: "Contato",
    hours: "Horários",
    closed: "Fechado",
    demo: "Demonstração Mandy's",
    allergens: "Alergênicos",
    noMenu: "O cardápio ainda não foi publicado.",
  },
  en: {
    eyebrow: "Atlantic cooking · Setúbal",
    titleFallback: "Fresh produce. Simple cooking. Setúbal at the table.",
    reserve: "Book a table",
    menu: "View menu",
    events: "Groups & events",
    menuTitle: "Menu",
    bookingTitle: "Book directly",
    bookingText: "Choose a date, time and party size. The request goes straight into the restaurant operation.",
    contact: "Contact",
    hours: "Opening hours",
    closed: "Closed",
    demo: "Mandy's demo",
    allergens: "Allergens",
    noMenu: "The menu has not been published yet.",
  },
  es: {
    eyebrow: "Cocina atlántica · Setúbal",
    titleFallback: "Producto fresco. Cocina sencilla. Setúbal en la mesa.",
    reserve: "Reservar mesa",
    menu: "Ver carta",
    events: "Grupos y eventos",
    menuTitle: "Carta",
    bookingTitle: "Reserva directamente",
    bookingText: "Elige fecha, hora y número de personas. La solicitud entra directamente en la operación del restaurante.",
    contact: "Contacto",
    hours: "Horario",
    closed: "Cerrado",
    demo: "Demo Mandy's",
    allergens: "Alérgenos",
    noMenu: "La carta todavía no se ha publicado.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const weekdays: Record<Locale, string[]> = {
  "pt-PT": ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  "pt-BR": ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
};

const themeStyle = toCssVariables(minimalTheme.tokens) as CSSProperties;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return {};
  const data = await getStorefrontData(rawLocale);
  return {
    title: data.restaurant.publicName,
    description: data.restaurant.description ?? undefined,
    robots: data.isDemo ? { index: false, follow: false } : undefined,
  };
}

export default async function RestaurantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();

  const requestedLocale = rawLocale;
  const data = await getStorefrontData(requestedLocale);
  const locale = data.locale;
  const c = copy[locale];
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: data.currency });
  const address = [
    data.location.addressLine1,
    data.location.addressLine2,
    [data.location.postalCode, data.location.city].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <main style={themeStyle} className="min-h-screen bg-[var(--mandys-background)] text-[var(--mandys-foreground)]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href={`/${locale}`} className="text-lg font-semibold tracking-[-0.04em]">{data.restaurant.publicName}</a>
        <div className="flex items-center gap-3">
          <a href={`/${locale}/events`} className="hidden text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)] sm:inline">{c.events}</a>
          <details className="relative text-sm">
            <summary className="cursor-pointer list-none text-[var(--mandys-foreground-muted)]">{localeLabels[locale]}</summary>
            <div className="absolute right-0 z-20 mt-3 min-w-48 rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-2 shadow-lg">
              {data.enabledLocales.map((item) => (
                <a key={item} href={`/${item}`} className="block rounded-md px-3 py-2 hover:bg-[var(--mandys-surface-muted)]">{localeLabels[item]}</a>
              ))}
            </div>
          </details>
          <a href="#booking" className="inline-flex min-h-11 items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-4 text-sm font-semibold text-[var(--mandys-accent-foreground)] transition hover:brightness-95">{c.reserve}</a>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[68vh] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mandys-accent)]">{c.eyebrow}</p>
            {data.isDemo ? <span className="rounded-full border border-[var(--mandys-border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mandys-foreground-muted)]">{c.demo}</span> : null}
          </div>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">{data.restaurant.publicName}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--mandys-foreground-muted)] sm:text-lg">{data.restaurant.description ?? c.titleFallback}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#booking" className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-5 text-sm font-semibold text-[var(--mandys-accent-foreground)] transition hover:brightness-95">{c.reserve}</a>
            <a href="#menu" className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] px-5 text-sm font-semibold transition hover:bg-[var(--mandys-surface-muted)]">{c.menu}</a>
            <a href={`/${locale}/events`} className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] px-5 text-sm font-semibold transition hover:bg-[var(--mandys-surface-muted)]">{c.events}</a>
          </div>
        </div>

        <aside className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 shadow-[var(--mandys-shadow-sm)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{data.location.name}</p>
          {address.length > 0 ? <address className="mt-4 not-italic text-sm leading-6 text-[var(--mandys-foreground-muted)]">{address.map((line) => <div key={line}>{line}</div>)}</address> : null}
          <div className="mt-7 border-t border-[var(--mandys-border)] pt-5">
            <p className="text-sm font-semibold">{c.hours}</p>
            <div className="mt-3 grid gap-2 text-sm">
              {data.openingHours.map((row) => (
                <div key={row.weekday} className="flex items-center justify-between gap-4 text-[var(--mandys-foreground-muted)]">
                  <span>{weekdays[locale][row.weekday] ?? row.weekday}</span><span>{row.isClosed ? c.closed : `${row.opensAt}–${row.closesAt}`}</span>
                </div>
              ))}
            </div>
          </div>
          {(data.restaurant.contactPhone || data.restaurant.contactEmail) ? (
            <div className="mt-7 border-t border-[var(--mandys-border)] pt-5"><p className="text-sm font-semibold">{c.contact}</p><div className="mt-2 space-y-1 text-sm text-[var(--mandys-foreground-muted)]">{data.restaurant.contactPhone ? <p>{data.restaurant.contactPhone}</p> : null}{data.restaurant.contactEmail ? <p>{data.restaurant.contactEmail}</p> : null}</div></div>
          ) : null}
        </aside>
      </section>

      <section id="menu" className="scroll-mt-6 border-t border-[var(--mandys-border)] bg-[var(--mandys-surface)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{c.menuTitle}</p>
          {data.menus.length === 0 ? <p className="mt-5 text-sm text-[var(--mandys-foreground-muted)]">{c.noMenu}</p> : (
            <div className="mt-8 space-y-16">
              {data.menus.map((menu) => (
                <div key={menu.id}>
                  <h2 className="text-3xl font-semibold tracking-[-0.04em]">{menu.name}</h2>
                  {menu.description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{menu.description}</p> : null}
                  <div className="mt-9 space-y-12">
                    {menu.categories.map((category) => (
                      <section key={category.id}>
                        <div className="border-b border-[var(--mandys-border)] pb-3"><h3 className="text-xl font-semibold">{category.name}</h3>{category.description ? <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{category.description}</p> : null}</div>
                        <div className="grid gap-x-10 md:grid-cols-2">
                          {category.items.map((item) => (
                            <article key={item.id} className="border-b border-[var(--mandys-border)] py-5">
                              <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium">{item.name}</h4>{item.isFeatured ? <span aria-label="featured" className="h-1.5 w-1.5 rounded-full bg-[var(--mandys-accent)]" /> : null}</div>{item.description ? <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{item.description}</p> : null}</div><span className="whitespace-nowrap text-sm font-semibold">{money.format(item.priceCents / 100)}</span></div>
                              {item.allergens.length > 0 ? <p className="mt-3 text-xs text-[var(--mandys-foreground-muted)]">{c.allergens}: {item.allergens.map((allergen) => allergen.name).join(", ")}</p> : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="booking" className="scroll-mt-6 border-t border-[var(--mandys-border)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:py-20">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">Mandy&apos;s Reserve</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{c.bookingTitle}</h2><p className="mt-4 max-w-lg text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.bookingText}</p></div>
          <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)] sm:p-7"><ReservationForm locale={locale} disabled={data.isDemo} /></div>
        </div>
      </section>

      <footer className="border-t border-[var(--mandys-border)] px-5 py-8 text-center text-xs text-[var(--mandys-foreground-muted)] sm:px-8">Powered by Mandy&apos;s · {data.restaurant.publicName}</footer>
    </main>
  );
}
