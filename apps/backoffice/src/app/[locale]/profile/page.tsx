import { isLocale } from "@mandys/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileBranding } from "./profile-branding";

const copy = {
  "pt-PT": { back: "Voltar ao painel", eyebrow: "Mandy's Core", title: "Perfil e marca", subtitle: "Informação pública, contactos, morada e identidade visual do restaurante." },
  "pt-BR": { back: "Voltar ao painel", eyebrow: "Mandy's Core", title: "Perfil e marca", subtitle: "Informações públicas, contatos, endereço e identidade visual do restaurante." },
  en: { back: "Back to dashboard", eyebrow: "Mandy's Core", title: "Profile & brand", subtitle: "Public information, contacts, address and restaurant brand identity." },
  es: { back: "Volver al panel", eyebrow: "Mandy's Core", title: "Perfil y marca", subtitle: "Información pública, contactos, dirección e identidad visual del restaurante." },
} as const;

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = copy[locale];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-[var(--mandys-border)] pb-6">
        <Link href={`/${locale}`} className="text-sm font-medium text-[var(--mandys-foreground-muted)] hover:text-[var(--mandys-foreground)]">← {c.back}</Link>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{c.eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{c.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
      </header>
      <ProfileBranding locale={locale} />
    </main>
  );
}
