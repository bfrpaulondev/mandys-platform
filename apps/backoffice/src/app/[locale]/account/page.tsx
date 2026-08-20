import { isLocale } from "@mandys/i18n";
import { PageHeader, PageShell } from "@mandys/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountProfile } from "./account-profile";
import { PasswordChange } from "./password-change";
import { SessionManagement } from "./session-management";

const copy = {
  "pt-PT": { back: "Voltar ao painel", eyebrow: "Conta", title: "A minha conta", subtitle: "Consulte o seu perfil e mantenha as credenciais e sessões da conta atualizadas." },
  "pt-BR": { back: "Voltar ao painel", eyebrow: "Conta", title: "Minha conta", subtitle: "Consulte seu perfil e mantenha as credenciais e sessões da conta atualizadas." },
  en: { back: "Back to dashboard", eyebrow: "Account", title: "My account", subtitle: "Review your profile and keep your account credentials and sessions up to date." },
  es: { back: "Volver al panel", eyebrow: "Cuenta", title: "Mi cuenta", subtitle: "Consulta tu perfil y mantén actualizadas las credenciales y sesiones de la cuenta." },
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
      <div className="space-y-6">
        <AccountProfile locale={locale} />
        <PasswordChange locale={locale} />
        <SessionManagement locale={locale} />
      </div>
    </PageShell>
  );
}
