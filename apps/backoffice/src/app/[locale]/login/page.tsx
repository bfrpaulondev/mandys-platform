import { isLocale, type Locale } from "@mandys/i18n";
import { Surface } from "@mandys/ui";
import { notFound } from "next/navigation";

import { LoginForm } from "./login-form";

const copy = {
  "pt-PT": {
    eyebrow: "Mandy's Backoffice",
    title: "Entre na operação do seu restaurante.",
    subtitle: "Aceda às reservas, menu, clientes e módulos do Mandy's.",
  },
  "pt-BR": {
    eyebrow: "Mandy's Backoffice",
    title: "Entre na operação do seu restaurante.",
    subtitle: "Acesse reservas, cardápio, clientes e módulos do Mandy's.",
  },
  en: {
    eyebrow: "Mandy's Backoffice",
    title: "Run your restaurant from one place.",
    subtitle: "Access reservations, menu, customers and Mandy's modules.",
  },
  es: {
    eyebrow: "Mandy's Backoffice",
    title: "Gestiona tu restaurante desde un solo lugar.",
    subtitle: "Accede a reservas, carta, clientes y módulos de Mandy's.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const c = copy[rawLocale];

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <Surface as="section" padding="none" className="w-full max-w-md p-6 shadow-[var(--mandys-shadow-sm)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">{c.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{c.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
        <LoginForm locale={rawLocale} />
      </Surface>
    </main>
  );
}
