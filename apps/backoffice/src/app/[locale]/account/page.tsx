import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountProfile } from "./account-profile";

const copy = {
  "pt-PT": { back: "Voltar ao painel", eyebrow: "Conta", title: "O meu perfil", subtitle: "Consulte os dados da sua conta e mantenha o seu nome atualizado." },
  "pt-BR": { back: "Voltar ao painel", eyebrow: "Conta", title: "Meu perfil", subtitle: "Consulte os dados da sua conta e mantenha seu nome atualizado." },
  en: { back: "Back to dashboard", eyebrow: "Account", title: "My profile", subtitle: "Review your account details and keep your name up to date." },
  es: { back: "Volver al panel", eyebrow: "Cuenta", title: "Mi perfil", subtitle: "Consulta los datos de tu cuenta y mantén tu nombre actualizado." },
} as const;

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = copy[locale];

  return (
    <PageShell>
      <PageHeader
        back={<Link href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] transition hover:text-[var(--mandys-foreground)]">← {c.back}</Link>}
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
      />
      <AccountProfile locale={locale} />
    </PageShell>
  );
}
