"use client";

import type { Locale, ReservationStatus } from "@mandys/contracts";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Reservation = {
  id: string;
  locationId: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: ReservationStatus;
  notes: string | null;
};

type CoreResponse = {
  data: {
    configured: boolean;
    locations: Array<{ id: string; name: string; isActive: boolean }>;
  };
};

type ReservationsResponse = { data: Reservation[] };

type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": {
    title: "Reservas",
    subtitle: "Acompanhe o serviço e crie reservas diretamente no Mandy's.",
    newReservation: "Nova reserva",
    guestName: "Nome do cliente",
    partySize: "Pessoas",
    startsAt: "Data e hora",
    email: "Email (opcional)",
    phone: "Telefone (opcional)",
    notes: "Observações (opcional)",
    create: "Criar reserva",
    creating: "A criar…",
    upcoming: "Próximas reservas",
    empty: "Ainda não existem reservas neste período.",
    loading: "A carregar reservas…",
    retry: "Tentar novamente",
    noLocation: "Conclua a configuração do restaurante antes de criar reservas.",
    pending: "Pendente",
    confirmed: "Confirmada",
    seated: "Sentados",
    completed: "Concluída",
    cancelled: "Cancelada",
    no_show: "Não compareceu",
    confirm: "Confirmar",
    seat: "Sentar",
    complete: "Concluir",
    cancel: "Cancelar",
    noShow: "No-show",
    people: "pessoas",
  },
  "pt-BR": {
    title: "Reservas",
    subtitle: "Acompanhe o atendimento e crie reservas diretamente no Mandy's.",
    newReservation: "Nova reserva",
    guestName: "Nome do cliente",
    partySize: "Pessoas",
    startsAt: "Data e hora",
    email: "Email (opcional)",
    phone: "Telefone (opcional)",
    notes: "Observações (opcional)",
    create: "Criar reserva",
    creating: "Criando…",
    upcoming: "Próximas reservas",
    empty: "Ainda não existem reservas neste período.",
    loading: "Carregando reservas…",
    retry: "Tentar novamente",
    noLocation: "Conclua a configuração do restaurante antes de criar reservas.",
    pending: "Pendente",
    confirmed: "Confirmada",
    seated: "Na mesa",
    completed: "Concluída",
    cancelled: "Cancelada",
    no_show: "Não compareceu",
    confirm: "Confirmar",
    seat: "Sentar",
    complete: "Concluir",
    cancel: "Cancelar",
    noShow: "No-show",
    people: "pessoas",
  },
  en: {
    title: "Reservations",
    subtitle: "Run service and create reservations directly in Mandy's.",
    newReservation: "New reservation",
    guestName: "Guest name",
    partySize: "Guests",
    startsAt: "Date and time",
    email: "Email (optional)",
    phone: "Phone (optional)",
    notes: "Notes (optional)",
    create: "Create reservation",
    creating: "Creating…",
    upcoming: "Upcoming reservations",
    empty: "There are no reservations in this period yet.",
    loading: "Loading reservations…",
    retry: "Try again",
    noLocation: "Finish restaurant setup before creating reservations.",
    pending: "Pending",
    confirmed: "Confirmed",
    seated: "Seated",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show",
    confirm: "Confirm",
    seat: "Seat",
    complete: "Complete",
    cancel: "Cancel",
    noShow: "No-show",
    people: "guests",
  },
  es: {
    title: "Reservas",
    subtitle: "Gestiona el servicio y crea reservas directamente en Mandy's.",
    newReservation: "Nueva reserva",
    guestName: "Nombre del cliente",
    partySize: "Personas",
    startsAt: "Fecha y hora",
    email: "Email (opcional)",
    phone: "Teléfono (opcional)",
    notes: "Observaciones (opcional)",
    create: "Crear reserva",
    creating: "Creando…",
    upcoming: "Próximas reservas",
    empty: "Todavía no hay reservas en este período.",
    loading: "Cargando reservas…",
    retry: "Intentar de nuevo",
    noLocation: "Completa la configuración del restaurante antes de crear reservas.",
    pending: "Pendiente",
    confirmed: "Confirmada",
    seated: "Sentados",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No se presentó",
    confirm: "Confirmar",
    seat: "Sentar",
    complete: "Completar",
    cancel: "Cancelar",
    noShow: "No-show",
    people: "personas",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const transitions: Record<ReservationStatus, Array<{ status: ReservationStatus; key: "confirm" | "seat" | "complete" | "cancel" | "noShow" }>> = {
  pending: [
    { status: "confirmed", key: "confirm" },
    { status: "cancelled", key: "cancel" },
  ],
  confirmed: [
    { status: "seated", key: "seat" },
    { status: "cancelled", key: "cancel" },
    { status: "no_show", key: "noShow" },
  ],
  seated: [{ status: "completed", key: "complete" }],
  completed: [],
  cancelled: [],
  no_show: [],
};

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  return body.message ?? `Request failed (${response.status})`;
}

export function ReservationsBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [locationId, setLocationId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const coreResponse = await fetch(`${apiBaseUrl}/v1/core`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!coreResponse.ok) throw new Error(await readError(coreResponse));

      const core = (await coreResponse.json()) as CoreResponse;
      const activeLocation = core.data.locations.find((location) => location.isActive) ?? null;
      setLocationId(activeLocation?.id ?? null);

      if (!activeLocation) {
        setReservations([]);
        return;
      }

      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);

      const params = new URLSearchParams({
        locationId: activeLocation.id,
        from: from.toISOString(),
        to: to.toISOString(),
        limit: "200",
      });

      const reservationResponse = await fetch(`${apiBaseUrl}/v1/reservations?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!reservationResponse.ok) throw new Error(await readError(reservationResponse));

      const body = (await reservationResponse.json()) as ReservationsResponse;
      setReservations(body.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReservation(formData: FormData) {
    if (!locationId) return;

    const startsAtValue = String(formData.get("startsAt") ?? "");
    const startsAt = new Date(startsAtValue);
    const endsAt = new Date(startsAt.getTime() + 90 * 60_000);

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/v1/reservations`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId,
          guestName: String(formData.get("guestName") ?? ""),
          partySize: Number(formData.get("partySize") ?? 2),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          ...(formData.get("guestEmail") ? { guestEmail: String(formData.get("guestEmail")) } : {}),
          ...(formData.get("guestPhone") ? { guestPhone: String(formData.get("guestPhone")) } : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
        }),
      });

      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(reservationId: string, status: ReservationStatus) {
    setBusyReservationId(reservationId);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/v1/reservations/${reservationId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unexpected error");
    } finally {
      setBusyReservationId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="h-fit rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
        <h2 className="text-lg font-semibold">{c.newReservation}</h2>
        {!locationId && !loading ? (
          <p className="mt-3 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.noLocation}</p>
        ) : (
          <form action={submitReservation} className="mt-5 space-y-4">
            <label className="block text-sm font-medium">
              {c.guestName}
              <input name="guestName" required minLength={2} maxLength={120} className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]" />
            </label>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <label className="block text-sm font-medium">
                {c.startsAt}
                <input name="startsAt" type="datetime-local" required className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]" />
              </label>
              <label className="block text-sm font-medium">
                {c.partySize}
                <input name="partySize" type="number" min={1} max={100} defaultValue={2} required className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]" />
              </label>
            </div>
            <label className="block text-sm font-medium">
              {c.email}
              <input name="guestEmail" type="email" className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]" />
            </label>
            <label className="block text-sm font-medium">
              {c.phone}
              <input name="guestPhone" maxLength={40} className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]" />
            </label>
            <label className="block text-sm font-medium">
              {c.notes}
              <textarea name="notes" maxLength={2000} rows={3} className="mt-1.5 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]" />
            </label>
            <Button type="submit" className="w-full" disabled={submitting || !locationId}>
              {submitting ? c.creating : c.create}
            </Button>
          </form>
        )}
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{c.upcoming}</h2>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {c.retry}
          </Button>
        </div>

        {error ? (
          <div className="mb-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-danger)]/30 bg-[var(--mandys-surface)] p-4 text-sm text-[var(--mandys-danger)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div>
        ) : reservations.length === 0 ? (
          <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</div>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => (
              <article key={reservation.id} className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{reservation.guestName}</h3>
                      <span className="rounded-full bg-[var(--mandys-surface-muted)] px-2.5 py-1 text-xs font-medium">
                        {c[reservation.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">
                      {dateFormatter.format(new Date(reservation.startsAt))} · {reservation.partySize} {c.people}
                    </p>
                    {reservation.notes ? <p className="mt-2 text-sm">{reservation.notes}</p> : null}
                  </div>

                  {transitions[reservation.status].length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {transitions[reservation.status].map((action) => (
                        <Button
                          key={action.status}
                          size="sm"
                          variant={action.status === "cancelled" || action.status === "no_show" ? "secondary" : "primary"}
                          disabled={busyReservationId === reservation.id}
                          onClick={() => void changeStatus(reservation.id, action.status)}
                        >
                          {c[action.key]}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
