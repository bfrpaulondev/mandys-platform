import { isLocale } from "@mandys/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OperationsSettings } from "./operations-settings";
import { SpecialHoursSettings } from "./special-hours-settings";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Operação", subtitle: "Horários, feriados, salas e mesas do restaurante." },
  "pt-BR": { back: "Voltar ao painel", title: "Operação", subtitle: "Horários, feriados, salões e mesas do restaurante." },
  en: { back: "Back to dashboard", title: "Operations", subtitle: "Restaurant hours, holidays, dining areas and tables." },
  es: { back: "Volver al panel", title: "Operación", subtitle: "Horarios, festivos, zonas y mesas del restaurante." },
} as const;

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = copy[locale];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-[var(--mandys-border)] pb-6">
        <Link href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]">
          ← {c.back}
        </Link>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">Mandy&apos;s Core</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{c.title}</h1>
        <p className="mt-2 text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
      </header>
      <div className="space-y-6">
        <SpecialHoursSettings locale={locale} />
        <OperationsSettings locale={locale} />
      </div>
    </main>
  );
}
