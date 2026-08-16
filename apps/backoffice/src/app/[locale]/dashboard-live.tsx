"use client";

import { localeLabels, type Locale } from "@mandys/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type CoreSnapshot = {
  configured: boolean;
  currentRole: string;
  profiles: Array<{ publicName: string }>;
  locations: Array<{ id: string; name: string; isActive: boolean }>;
  modules: Array<{ moduleKey: string; status: "enabled" | "disabled" | "trial" }>;
};

type Reservation = {
  id: string;
  guestName: string;
  startsAt: string;
  partySize: number;
  status: "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
};

const copy = {
  "pt-PT": {
    subtitle: "A operação do restaurante, num único lugar.",
    loading: "A carregar a operação…",
    error: "Não foi possível carregar os dados do restaurante.",
    retry: "Tentar novamente",
    todayReservations: "reservas hoje",
    guests: "pessoas previstas",
    activeModules: "módulos ativos",
    next: "Próxima reserva",
    noNext: "Sem próximas reservas hoje",
    manage: "Gerir reservas",
    manageMenu: "Gerir menu",
    manageEvents: "Gerir eventos",
    modules: "Módulos",
    active: "Ativo",
    planned: "Planeado",
    menu: "Menu",
    reservations: "Reservas",
    events: "Eventos",
    stock: "Stock",
    stockText: "Ingredientes, custos, compras e desperdício.",
    ai: "Mandy's AI",
    aiText: "Análise inteligente sobre os dados reais do restaurante.",
    people: "pessoas",
    role: "perfil",
  },
  "pt-BR": {
    subtitle: "A operação do restaurante em um só lugar.",
    loading: "Carregando a operação…",
    error: "Não foi possível carregar os dados do restaurante.",
    retry: "Tentar novamente",
    todayReservations: "reservas hoje",
    guests: "pessoas previstas",
    activeModules: "módulos ativos",
    next: "Próxima reserva",
    noNext: "Sem próximas reservas hoje",
    manage: "Gerenciar reservas",
    manageMenu: "Gerenciar cardápio",
    manageEvents: "Gerenciar eventos",
    modules: "Módulos",
    active: "Ativo",
    planned: "Planejado",
    menu: "Cardápio",
    reservations: "Reservas",
    events: "Eventos",
    stock: "Estoque",
    stockText: "Ingredientes, custos, compras e desperdício.",
    ai: "Mandy's AI",
    aiText: "Análise inteligente sobre os dados reais do restaurante.",
    people: "pessoas",
    role: "perfil",
  },
  en: {
    subtitle: "Your restaurant operation, in one place.",
    loading: "Loading the operation…",
    error: "We couldn't load the restaurant data.",
    retry: "Try again",
    todayReservations: "reservations today",
    guests: "expected guests",
    activeModules: "active modules",
    next: "Next reservation",
    noNext: "No more reservations today",
    manage: "Manage reservations",
    manageMenu: "Manage menu",
    manageEvents: "Manage events",
    modules: "Modules",
    active: "Active",
    planned: "Planned",
    menu: "Menu",
    reservations: "Reservations",
    events: "Events",
    stock: "Stock",
    stockText: "Ingredients, costs, purchasing and waste.",
    ai: "Mandy's AI",
    aiText: "Intelligent analysis grounded in real restaurant data.",
    people: "guests",
    role: "role",
  },
  es: {
    subtitle: "La operación de tu restaurante, en un solo lugar.",
    loading: "Cargando la operación…",
    error: "No se pudieron cargar los datos del restaurante.",
    retry: "Intentar de nuevo",
    todayReservations: "reservas hoy",
    guests: "personas previstas",
    activeModules: "módulos activos",
    next: "Próxima reserva",
    noNext: "No hay más reservas hoy",
    manage: "Gestionar reservas",
    manageMenu: "Gestionar menú",
    manageEvents: "Gestionar eventos",
    modules: "Módulos",
    active: "Activo",
    planned: "Planeado",
    menu: "Menú",
    reservations: "Reservas",
    events: "Eventos",
    stock: "Inventario",
    stockText: "Ingredientes, costes, compras y desperdicio.",
    ai: "Mandy's AI",
    aiText: "Análisis inteligente basado en datos reales del restaurante.",
    people: "personas",
    role: "perfil",
  },
} as const satisfies Record<Locale, Record<string, string>>;

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? `Request failed (${response.status})`;
}

export function DashboardLive({ locale }: { locale: Locale }) {
  const router = useRouter();
  const c = copy[locale];
  const [core, setCore] = useState<CoreSnapshot | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coreResponse = await fetch("/api/runtime/v1/core", {
        credentials: "include",
        cache: "no-store",
      });
      if (!coreResponse.ok) throw new Error(await readError(coreResponse));
      const coreBody = (await coreResponse.json()) as { data: CoreSnapshot };
      setCore(coreBody.data);

      if (!coreBody.data.configured) {
        router.replace(`/${locale}/onboarding`);
        return;
      }

      const location = coreBody.data.locations.find((item) => item.isActive);
      if (!location) {
        setReservations([]);
        return;
      }

      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      const params = new URLSearchParams({
        locationId: location.id,
        from: from.toISOString(),
        to: to.toISOString(),
        limit: "200",
      });
      const reservationResponse = await fetch(`/api/runtime/v1/reservations?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!reservationResponse.ok) throw new Error(await readError(reservationResponse));
      const reservationBody = (await reservationResponse.json()) as { data: Reservation[] };
      setReservations(reservationBody.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : c.error);
    } finally {
      setLoading(false);
    }
  }, [c.error, locale, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !core) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6">
        <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</p>
      </main>
    );
  }

  if (error && !core) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6">
        <div className="max-w-md rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-center">
          <p className="text-sm text-[var(--mandys-danger)]">{error}</p>
          <button className="mt-4 rounded-xl border border-[var(--mandys-border)] px-4 py-2 text-sm font-medium" onClick={() => void load()}>
            {c.retry}
          </button>
        </div>
      </main>
    );
  }

  if (!core) return null;

  const activeReservations = reservations.filter((item) => !["cancelled", "no_show"].includes(item.status));
  const guests = activeReservations.reduce((sum, item) => sum + item.partySize, 0);
  const now = Date.now();
  const nextReservation = activeReservations.find((item) => new Date(item.startsAt).getTime() >= now) ?? null;
  const activeModules = core.modules.filter((item) => item.status === "enabled" || item.status === "trial");
  const restaurantName = core.profiles[0]?.publicName ?? "Mandy's";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-5 border-b border-[var(--mandys-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">Mandy&apos;s</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{restaurantName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--mandys-foreground-muted)]">
          <span>{localeLabels[locale]}</span>
          <span aria-hidden="true">·</span>
          <span>{c.role}: {core.currentRole}</span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <p className="text-2xl font-semibold tracking-[-0.03em]">{activeReservations.length}</p>
          <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.todayReservations}</p>
        </article>
        <article className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <p className="text-2xl font-semibold tracking-[-0.03em]">{guests}</p>
          <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.guests}</p>
        </article>
        <article className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <p className="text-2xl font-semibold tracking-[-0.03em]">{activeModules.length}</p>
          <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.activeModules}</p>
        </article>
        <article className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <p className="text-2xl font-semibold tracking-[-0.03em]">
            {nextReservation ? dateFormatter.format(new Date(nextReservation.startsAt)) : "—"}
          </p>
          <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.next}</p>
        </article>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
          <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.next}</p>
          {nextReservation ? (
            <>
              <h2 className="mt-2 text-xl font-semibold">
                {dateFormatter.format(new Date(nextReservation.startsAt))} · {nextReservation.guestName}
              </h2>
              <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{nextReservation.partySize} {c.people}</p>
            </>
          ) : (
            <h2 className="mt-2 text-xl font-semibold">{c.noNext}</h2>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${locale}/reservations`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-4 text-sm font-medium text-[var(--mandys-accent-foreground)] transition hover:brightness-95">
              {c.manage}
            </Link>
            <Link href={`/${locale}/menu`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] px-4 text-sm font-medium transition hover:bg-[var(--mandys-surface-muted)]">
              {c.manageMenu}
            </Link>
            <Link href={`/${locale}/events`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] px-4 text-sm font-medium transition hover:bg-[var(--mandys-surface-muted)]">
              {c.manageEvents}
            </Link>
          </div>
          {error ? <p className="mt-4 text-sm text-[var(--mandys-danger)]">{error}</p> : null}
        </article>

        <aside className="rounded-[var(--mandys-radius-lg)] bg-[var(--mandys-foreground)] p-5 text-white sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{c.modules}</p>
          <div className="mt-5 space-y-4">
            {[
              ["reservations", c.reservations],
              ["menu", c.menu],
              ["events", c.events],
            ].map(([key, label]) => {
              const module = core.modules.find((item) => item.moduleKey === key);
              const active = module?.status === "enabled" || module?.status === "trial";
              return (
                <div key={key} className="flex items-center justify-between gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                  <p className="font-medium">{label}</p>
                  <span className="text-xs text-white/60">{active ? c.active : c.planned}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-2">
        <article className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-5 sm:p-6">
          <p className="font-semibold">{c.stock}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.stockText}</p>
          <span className="mt-4 inline-block text-xs font-medium text-[var(--mandys-foreground-muted)]">{c.planned}</span>
        </article>
        <article className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-5 sm:p-6">
          <p className="font-semibold">{c.ai}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.aiText}</p>
          <span className="mt-4 inline-block text-xs font-medium text-[var(--mandys-foreground-muted)]">{c.planned}</span>
        </article>
      </section>
    </main>
  );
}
