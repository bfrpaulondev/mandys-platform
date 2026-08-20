import { isLocale, type Locale } from "@mandys/i18n";
import { Surface } from "@mandys/ui";
import { notFound } from "next/navigation";

import { ResetPasswordForm } from "./reset-password-form";

const copy = {
  "pt-PT": { eyebrow: "Mandy's Backoffice", title: "Defina uma nova palavra-passe.", subtitle: "Use o link seguro enviado para o seu email. Por segurança, o link expira e só pode ser usado para esta recuperação." },
  "pt-BR": { eyebrow: "Mandy's Backoffice", title: "Defina uma nova senha.", subtitle: "Use o link seguro enviado para o seu e-mail. Por segurança, o link expira e só pode ser usado para esta recuperação." },
  en: { eyebrow: "Mandy's Backoffice", title: "Set a new password.", subtitle: "Use the secure link sent to your email. For security, the link expires and is only valid for this recovery." },
  es: { eyebrow: "Mandy's Backoffice", title: "Define una nueva contraseña.", subtitle: "Usa el enlace seguro enviado a tu correo. Por seguridad, el enlace caduca y solo es válido para esta recuperación." },
} as const satisfies Record<Locale, Record<string, string>>;

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const c = copy[rawLocale];

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <Surface as="section" padding="none" className="w-full max-w-md p-6 shadow-[var(--mandys-shadow-sm)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{c.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{c.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
        <ResetPasswordForm locale={rawLocale} />
      </Surface>
    </main>
  );
}
