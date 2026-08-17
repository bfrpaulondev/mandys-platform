import { isLocale } from "@mandys/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamBoard } from "./team-board";

const copy = {
  "pt-PT": {
    back: "Voltar ao painel",
    title: "Equipa e acessos",
    subtitle: "Convide pessoas e atribua apenas as permissões necessárias para operar o restaurante.",
  },
  "pt-BR": {
    back: "Voltar ao painel",
    title: "Equipe e acessos",
    subtitle: "Convide pessoas e atribua somente as permissões necessárias para operar o restaurante.",
  },
  en: {
    back: "Back to dashboard",
    title: "Team and access",
    subtitle: "Invite people and give them only the permissions they need to run the restaurant.",
  },
  es: {
    back: "Volver al panel",
    title: "Equipo y accesos",
    subtitle: "Invita personas y asigna solo los permisos necesarios para operar el restaurante.",
  },
} as const;

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = copy[locale];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-[var(--mandys-border)] pb-6">
        <Link
          href={`/${locale}`}
          className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]"
        >
          ← {c.back}
        </Link>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">
          Mandy&apos;s Core
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{c.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
      </header>
      <TeamBoard locale={locale} />
    </main>
  );
}
