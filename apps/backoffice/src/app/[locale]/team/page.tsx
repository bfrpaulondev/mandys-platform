import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
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
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow="Mandy's Core"
        title={c.title}
        subtitle={c.subtitle}
      />
      <TeamBoard locale={locale} />
    </PageShell>
  );
}
