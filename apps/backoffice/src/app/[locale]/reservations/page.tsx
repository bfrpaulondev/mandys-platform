import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReservationsBoardV2 } from "./reservations-board-v2";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Reservas" },
  "pt-BR": { back: "Voltar ao painel", title: "Reservas" },
  en: { back: "Back to dashboard", title: "Reservations" },
  es: { back: "Volver al panel", title: "Reservas" },
} as const;

export default async function ReservationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's Reserve"
        title={c.title}
      />
      <ReservationsBoardV2 locale={locale} />
    </PageShell>
  );
}
