import { isLocale } from "@mandys/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

const copy = {
  "pt-PT": { reservations: "Agenda", policy: "Política", waitlist: "Lista de espera" },
  "pt-BR": { reservations: "Agenda", policy: "Política", waitlist: "Lista de espera" },
  en: { reservations: "Bookings", policy: "Policy", waitlist: "Waitlist" },
  es: { reservations: "Agenda", policy: "Política", waitlist: "Lista de espera" },
} as const;

export default async function ReservationsLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <>
      <div className="sticky top-[69px] z-30 border-b border-[var(--mandys-border)] bg-[var(--mandys-background)]/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-[1500px] gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8" aria-label="Mandy's Reserve">
          <Link href={`/${locale}/reservations`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--mandys-surface-muted)]">{c.reservations}</Link>
          <Link href={`/${locale}/reservations/policy`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--mandys-surface-muted)]">{c.policy}</Link>
          <Link href={`/${locale}/reservations/waitlist`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--mandys-surface-muted)]">{c.waitlist}</Link>
        </nav>
      </div>
      {children}
    </>
  );
}
