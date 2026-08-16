import { isLocale } from "@mandys/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReservationsBoard } from "./reservations-board";

const backLabel = {
  "pt-PT": "Voltar ao painel",
  "pt-BR": "Voltar ao painel",
  en: "Back to dashboard",
  es: "Volver al panel",
} as const;

export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-[var(--mandys-border)] pb-6">
        <Link
          href={`/${locale}`}
          className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]"
        >
          ← {backLabel[locale]}
        </Link>
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">
            Mandy&apos;s Reserve
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Reservations</h1>
        </div>
      </header>

      <ReservationsBoard locale={locale} />
    </main>
  );
}
