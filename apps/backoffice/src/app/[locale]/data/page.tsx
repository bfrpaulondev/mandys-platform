import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell, pageBackLinkClassName } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataProtectionBoard } from "./data-protection-board";
import { RetentionPolicyCard } from "./retention-policy-card";

const copy = {
  "pt-PT": { back: "Voltar ao painel", title: "Dados e privacidade", eyebrow: "Proteção de dados" },
  "pt-BR": { back: "Voltar ao painel", title: "Dados e privacidade", eyebrow: "Proteção de dados" },
  en: { back: "Back to dashboard", title: "Data & privacy", eyebrow: "Data protection" },
  es: { back: "Volver al panel", title: "Datos y privacidad", eyebrow: "Protección de datos" },
} as const;

export default async function DataProtectionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className={pageBackLinkClassName}>← {c.back}</Link>}
        eyebrow={c.eyebrow}
        title={c.title}
      />
      <div className="space-y-6">
        <RetentionPolicyCard locale={locale} />
        <DataProtectionBoard locale={locale} />
      </div>
    </PageShell>
  );
}
