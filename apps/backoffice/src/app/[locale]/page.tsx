import { isLocale, localeLabels, t, type Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { notFound } from "next/navigation";

const copy = {
  "pt-PT": {
    subtitle: "A operação do restaurante, num único lugar.",
    restaurant: "Restaurante Demo",
    people: "pessoas reservadas",
    occupancy: "ocupação prevista",
    next: "Próxima reserva",
    manage: "Gerir reservas",
    modules: "Módulos",
    included: "Ativo",
    locked: "Disponível como módulo",
    stock: "Estoque",
    stockText: "Ingredientes, custos, compras e desperdício.",
    ai: "Mandy's AI",
    aiText: "Pergunte aos dados do seu restaurante e receba análises acionáveis.",
  },
  "pt-BR": {
    subtitle: "A operação do restaurante em um só lugar.",
    restaurant: "Restaurante Demo",
    people: "pessoas reservadas",
    occupancy: "ocupação prevista",
    next: "Próxima reserva",
    manage: "Gerenciar reservas",
    modules: "Módulos",
    included: "Ativo",
    locked: "Disponível como módulo",
    stock: "Estoque",
    stockText: "Ingredientes, custos, compras e desperdício.",
    ai: "Mandy's AI",
    aiText: "Pergunte aos dados do seu restaurante e receba análises úteis.",
  },
  en: {
    subtitle: "Your restaurant operation, in one place.",
    restaurant: "Demo Restaurant",
    people: "reserved guests",
    occupancy: "forecast occupancy",
    next: "Next reservation",
    manage: "Manage reservations",
    modules: "Modules",
    included: "Active",
    locked: "Available as a module",
    stock: "Stock",
    stockText: "Ingredients, costs, purchasing and waste.",
    ai: "Mandy's AI",
    aiText: "Ask questions about restaurant data and get actionable analysis.",
  },
  es: {
    subtitle: "La operación de tu restaurante, en un solo lugar.",
    restaurant: "Restaurante Demo",
    people: "personas reservadas",
    occupancy: "ocupación prevista",
    next: "Próxima reserva",
    manage: "Gestionar reservas",
    modules: "Módulos",
    included: "Activo",
    locked: "Disponible como módulo",
    stock: "Inventario",
    stockText: "Ingredientes, costes, compras y desperdicio.",
    ai: "Mandy's AI",
    aiText: "Pregunta a los datos de tu restaurante y recibe análisis accionables.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const c = copy[locale];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-5 border-b border-[var(--mandys-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">
            Mandy&apos;s
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{t(locale, "dashboard")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--mandys-foreground-muted)]">
          <span>{c.restaurant}</span>
          <span aria-hidden="true">·</span>
          <span>{localeLabels[locale]}</span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t(locale, "today")}>
        {[
          ["48", t(locale, "reservations")],
          ["126", c.people],
          ["81%", c.occupancy],
          ["20:30", c.next],
        ].map(([value, label]) => (
          <article key={label} className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
            <p className="text-2xl font-semibold tracking-[-0.03em]">{value}</p>
            <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.next}</p>
              <h2 className="mt-2 text-xl font-semibold">20:30 · João Silva</h2>
              <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">4 pessoas · Interior · Mesa 8</p>
            </div>
            <span className="rounded-full bg-[var(--mandys-surface-muted)] px-3 py-1 text-xs font-medium">{t(locale, "today")}</span>
          </div>
          <div className="mt-8">
            <Button>{c.manage}</Button>
          </div>
        </article>

        <aside className="rounded-[var(--mandys-radius-lg)] bg-[var(--mandys-foreground)] p-5 text-white sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{c.modules}</p>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{t(locale, "reservations")}</p>
                <span className="text-xs text-white/60">{c.included}</span>
              </div>
            </div>
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{c.stock}</p>
                <span className="text-xs text-white/60">{c.locked}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-white/60">{c.stockText}</p>
            </div>
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{c.ai}</p>
                <span className="text-xs text-white/60">{c.locked}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-white/60">{c.aiText}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
