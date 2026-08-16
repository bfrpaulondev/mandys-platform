import { isLocale, type Locale } from "@mandys/i18n";
import { notFound } from "next/navigation";

import { OnboardingForm } from "./onboarding-form";

const copy = {
  "pt-PT": {
    eyebrow: "Configuração inicial",
    title: "Vamos preparar o seu restaurante.",
    subtitle: "Crie a primeira localização, escolha os idiomas e deixe o Mandy's pronto para receber o menu e as reservas.",
  },
  "pt-BR": {
    eyebrow: "Configuração inicial",
    title: "Vamos preparar o seu restaurante.",
    subtitle: "Crie a primeira unidade, escolha os idiomas e deixe o Mandy's pronto para receber o cardápio e as reservas.",
  },
  en: {
    eyebrow: "Initial setup",
    title: "Let's prepare your restaurant.",
    subtitle: "Create the first location, choose languages and get Mandy's ready for menu and reservations.",
  },
  es: {
    eyebrow: "Configuración inicial",
    title: "Preparemos tu restaurante.",
    subtitle: "Crea la primera ubicación, elige los idiomas y deja Mandy's listo para la carta y las reservas.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const c = copy[rawLocale];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{c.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{c.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
      </header>
      <OnboardingForm locale={rawLocale} />
    </main>
  );
}
