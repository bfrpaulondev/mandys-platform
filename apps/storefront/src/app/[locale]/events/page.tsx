import { isLocale, type Locale } from "@mandys/i18n";
import { toCssVariables } from "@mandys/theme-core";
import { minimalTheme } from "@mandys/theme-minimal";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { getStorefrontData } from "../../../lib/storefront";
import { EventInquiryForm } from "../event-inquiry-form";

const copy = {
  "pt-PT": { back: "Voltar ao restaurante", eyebrow: "Grupos e eventos", title: "Planeie o seu evento connosco.", text: "Aniversários, jantares de grupo, empresas e ocasiões especiais. Envie os detalhes e a equipa do restaurante acompanha o pedido." },
  "pt-BR": { back: "Voltar ao restaurante", eyebrow: "Grupos e eventos", title: "Planeje seu evento conosco.", text: "Aniversários, jantares em grupo, empresas e ocasiões especiais. Envie os detalhes e a equipe do restaurante acompanha o pedido." },
  en: { back: "Back to restaurant", eyebrow: "Groups & events", title: "Plan your event with us.", text: "Birthdays, group dinners, company events and special occasions. Send the details and the restaurant team will follow your enquiry." },
  es: { back: "Volver al restaurante", eyebrow: "Grupos y eventos", title: "Planifica tu evento con nosotros.", text: "Cumpleaños, cenas de grupo, empresas y ocasiones especiales. Envíanos los detalles y el equipo del restaurante gestionará la solicitud." },
} as const satisfies Record<Locale, Record<string, string>>;

const themeStyle = toCssVariables(minimalTheme.tokens) as CSSProperties;
export const dynamic = "force-dynamic";

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const data = await getStorefrontData(rawLocale);
  const locale = data.locale;
  const c = copy[locale];

  return (
    <main style={themeStyle} className="min-h-screen bg-[var(--mandys-background)] text-[var(--mandys-foreground)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href={`/${locale}`} className="text-lg font-semibold tracking-[-0.04em]">{data.restaurant.publicName}</a>
        <a href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]">← {c.back}</a>
      </nav>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">Mandy&apos;s Events · {c.eyebrow}</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{c.title}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--mandys-foreground-muted)]">{c.text}</p>
        </div>
        <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)] sm:p-7">
          <EventInquiryForm locale={locale} />
        </div>
      </section>
    </main>
  );
}
