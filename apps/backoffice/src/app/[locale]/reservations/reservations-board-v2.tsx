"use client";

import type { Locale, ReservationStatus } from "@mandys/contracts";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: ReservationStatus;
  notes: string | null;
  source: string;
  tableName: string | null;
  diningAreaName: string | null;
};

type Slot = { startsAt: string; endsAt: string; available: boolean; remainingCapacity: number };
type AvailabilityResponse = { data: { locationId: string; timezone: string; durationMinutes: number; slots: Slot[] } };
type ReservationsResponse = { data: Reservation[] };
type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": {
    title: "Reservas", subtitle: "Disponibilidade real baseada nos horários, mesas, capacidade e reservas já existentes.",
    newReservation: "Nova reserva", guestName: "Nome do cliente", partySize: "Pessoas", date: "Data", time: "Hora disponível",
    email: "Email (opcional)", phone: "Telefone (opcional)", notes: "Observações (opcional)", create: "Criar reserva", creating: "A criar…",
    upcoming: "Próximas reservas", empty: "Ainda não existem reservas neste período.", loading: "A carregar reservas…", retry: "Atualizar",
    noSlots: "Não existem horários disponíveis para esta data e número de pessoas.", chooseSlot: "Escolher horário", capacity: "lugares restantes",
    pending: "Pendente", confirmed: "Confirmada", seated: "Sentados", completed: "Concluída", cancelled: "Cancelada", no_show: "Não compareceu",
    confirm: "Confirmar", seat: "Sentar", complete: "Concluir", cancel: "Cancelar", noShow: "No-show", table: "Mesa", area: "Zona", source: "Origem",
    summaryToday: "Hoje", summaryGuests: "Pessoas hoje", summaryPending: "Por confirmar", invalidSlot: "Escolha um horário disponível.",
  },
  "pt-BR": {
    title: "Reservas", subtitle: "Disponibilidade real baseada nos horários, mesas, capacidade e reservas existentes.",
    newReservation: "Nova reserva", guestName: "Nome do cliente", partySize: "Pessoas", date: "Data", time: "Horário disponível",
    email: "E-mail (opcional)", phone: "Telefone (opcional)", notes: "Observações (opcional)", create: "Criar reserva", creating: "Criando…",
    upcoming: "Próximas reservas", empty: "Ainda não existem reservas neste período.", loading: "Carregando reservas…", retry: "Atualizar",
    noSlots: "Não existem horários disponíveis para esta data e número de pessoas.", chooseSlot: "Escolher horário", capacity: "lugares restantes",
    pending: "Pendente", confirmed: "Confirmada", seated: "Na mesa", completed: "Concluída", cancelled: "Cancelada", no_show: "Não compareceu",
    confirm: "Confirmar", seat: "Sentar", complete: "Concluir", cancel: "Cancelar", noShow: "No-show", table: "Mesa", area: "Área", source: "Origem",
    summaryToday: "Hoje", summaryGuests: "Pessoas hoje", summaryPending: "A confirmar", invalidSlot: "Escolha um horário disponível.",
  },
  en: {
    title: "Reservations", subtitle: "Live availability based on opening hours, tables, capacity and existing bookings.",
    newReservation: "New reservation", guestName: "Guest name", partySize: "Guests", date: "Date", time: "Available time",
    email: "Email (optional)", phone: "Phone (optional)", notes: "Notes (optional)", create: "Create reservation", creating: "Creating…",
    upcoming: "Upcoming reservations", empty: "There are no reservations in this period yet.", loading: "Loading reservations…", retry: "Refresh",
    noSlots: "There are no available times for this date and party size.", chooseSlot: "Choose a time", capacity: "seats remaining",
    pending: "Pending", confirmed: "Confirmed", seated: "Seated", completed: "Completed", cancelled: "Cancelled", no_show: "No-show",
    confirm: "Confirm", seat: "Seat", complete: "Complete", cancel: "Cancel", noShow: "No-show", table: "Table", area: "Area", source: "Source",
    summaryToday: "Today", summaryGuests: "Guests today", summaryPending: "Awaiting confirmation", invalidSlot: "Choose an available time.",
  },
  es: {
    title: "Reservas", subtitle: "Disponibilidad real basada en horarios, mesas, capacidad y reservas existentes.",
    newReservation: "Nueva reserva", guestName: "Nombre del cliente", partySize: "Personas", date: "Fecha", time: "Hora disponible",
    email: "Email (opcional)", phone: "Teléfono (opcional)", notes: "Observaciones (opcional)", create: "Crear reserva", creating: "Creando…",
    upcoming: "Próximas reservas", empty: "Todavía no hay reservas en este período.", loading: "Cargando reservas…", retry: "Actualizar",
    noSlots: "No hay horarios disponibles para esta fecha y número de personas.", chooseSlot: "Elegir horario", capacity: "plazas restantes",
    pending: "Pendiente", confirmed: "Confirmada", seated: "Sentados", completed: "Completada", cancelled: "Cancelada", no_show: "No se presentó",
    confirm: "Confirmar", seat: "Sentar", complete: "Completar", cancel: "Cancelar", noShow: "No-show", table: "Mesa", area: "Zona", source: "Origen",
    summaryToday: "Hoy", summaryGuests: "Personas hoy", summaryPending: "Por confirmar", invalidSlot: "Elige un horario disponible.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const transitions: Record<ReservationStatus, Array<{ status: ReservationStatus; key: "confirm" | "seat" | "complete" | "cancel" | "noShow" }>> = {
  pending: [{ status: "confirmed", key: "confirm" }, { status: "cancelled", key: "cancel" }],
  confirmed: [{ status: "seated", key: "seat" }, { status: "cancelled", key: "cancel" }, { status: "no_show", key: "noShow" }],
  seated: [{ status: "completed", key: "complete" }], completed: [], cancelled: [], no_show: [],
};

const fieldClassName = "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

function localDateValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  return body.message ?? `Request failed (${response.status})`;
}

export function ReservationsBoardV2({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [date, setDate] = useState(localDateValue());
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }), [locale]);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = new Date(from); to.setDate(to.getDate() + 14);
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), limit: "200" });
      const response = await fetch(`/api/reservations/v1/reservations?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as ReservationsResponse;
      setReservations(body.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error");
    } finally { setLoading(false); }
  }, []);

  const loadAvailability = useCallback(async (targetDate: string, targetPartySize: number) => {
    if (!targetDate || targetPartySize < 1) return;
    setSlotLoading(true);
    try {
      const params = new URLSearchParams({ date: targetDate, partySize: String(targetPartySize) });
      if (locationId) params.set("locationId", locationId);
      const response = await fetch(`/api/reservations/v1/availability?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as AvailabilityResponse;
      setLocationId(body.data.locationId);
      setSlots(body.data.slots.filter(slot => slot.available));
    } catch (availabilityError) {
      setSlots([]);
      setError(availabilityError instanceof Error ? availabilityError.message : "Unexpected error");
    } finally { setSlotLoading(false); }
  }, [locationId]);

  useEffect(() => { void loadReservations(); }, [loadReservations]);
  useEffect(() => { void loadAvailability(date, partySize); }, [date, partySize, loadAvailability]);

  async function submitReservation(formData: FormData) {
    if (!locationId) return;
    const startsAt = String(formData.get("startsAt") ?? "");
    if (!startsAt) { setError(c.invalidSlot); return; }
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/reservations/v1/reservations", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId, startsAt, partySize,
          guestName: String(formData.get("guestName") ?? ""),
          ...(formData.get("guestEmail") ? { guestEmail: String(formData.get("guestEmail")) } : {}),
          ...(formData.get("guestPhone") ? { guestPhone: String(formData.get("guestPhone")) } : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await Promise.all([loadReservations(), loadAvailability(date, partySize)]);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unexpected error"); }
    finally { setSubmitting(false); }
  }

  async function changeStatus(reservationId: string, status: ReservationStatus) {
    const previous = reservations.find((reservation) => reservation.id === reservationId);
    if (!previous || busyReservationId === reservationId) return;

    setBusyReservationId(reservationId);
    setError(null);
    setReservations((current) => current.map((reservation) => reservation.id === reservationId ? { ...reservation, status } : reservation));

    try {
      const response = await fetch(`/api/reservations/v1/reservations/${reservationId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await readError(response));
      void loadAvailability(date, partySize);
    } catch (statusError) {
      setReservations((current) => current.map((reservation) => reservation.id === reservationId ? previous : reservation));
      setError(statusError instanceof Error ? statusError.message : "Unexpected error");
      void loadAvailability(date, partySize);
    } finally {
      setBusyReservationId(null);
    }
  }

  const today = localDateValue();
  const todayReservations = reservations.filter(reservation => reservation.startsAt.slice(0, 10) === today && !["cancelled", "no_show"].includes(reservation.status));
  const todayGuests = todayReservations.reduce((sum, reservation) => sum + reservation.partySize, 0);
  const pending = reservations.filter(reservation => reservation.status === "pending").length;

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: c.summaryToday, value: todayReservations.length }, { label: c.summaryGuests, value: todayGuests }, { label: c.summaryPending, value: pending }].map(card => (
          <div key={card.label} className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4">
            <div className="text-2xl font-semibold">{card.value}</div><div className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{card.label}</div>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-danger)]/30 bg-[var(--mandys-surface)] p-4 text-sm text-[var(--mandys-danger)]">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="h-fit rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <h2 className="text-lg font-semibold">{c.newReservation}</h2>
          <form action={submitReservation} className="mt-5 space-y-4">
            <label className="block text-sm font-medium">{c.guestName}<input name="guestName" required minLength={2} maxLength={120} className={fieldClassName} /></label>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <label className="block text-sm font-medium">{c.date}<input name="date" type="date" min={localDateValue()} max={localDateValue(365)} value={date} onChange={event => setDate(event.target.value)} required className={fieldClassName} /></label>
              <label className="block text-sm font-medium">{c.partySize}<input name="partySize" type="number" min={1} max={100} value={partySize} onChange={event => setPartySize(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} required className={fieldClassName} /></label>
            </div>
            <label className="block text-sm font-medium">{c.time}
              <select name="startsAt" required disabled={slotLoading || slots.length === 0} className={fieldClassName} defaultValue="">
                <option value="">{slotLoading ? "…" : c.chooseSlot}</option>
                {slots.map(slot => <option key={slot.startsAt} value={slot.startsAt}>{timeFormatter.format(new Date(slot.startsAt))} · {slot.remainingCapacity} {c.capacity}</option>)}
              </select>
            </label>
            {!slotLoading && slots.length === 0 ? <p className="text-xs leading-5 text-[var(--mandys-foreground-muted)]">{c.noSlots}</p> : null}
            <label className="block text-sm font-medium">{c.email}<input name="guestEmail" type="email" className={fieldClassName} /></label>
            <label className="block text-sm font-medium">{c.phone}<input name="guestPhone" maxLength={40} className={fieldClassName} /></label>
            <label className="block text-sm font-medium">{c.notes}<textarea name="notes" maxLength={2000} rows={3} className={`${fieldClassName} py-2`} /></label>
            <Button type="submit" className="w-full" disabled={submitting || !locationId || slots.length === 0}>{submitting ? c.creating : c.create}</Button>
          </form>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{c.upcoming}</h2><Button variant="secondary" size="sm" onClick={() => void loadReservations()} disabled={loading}>{c.retry}</Button></div>
          {loading ? <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div>
          : reservations.length === 0 ? <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</div>
          : <div className="space-y-3">{reservations.map(reservation => (
            <article key={reservation.id} aria-busy={busyReservationId === reservation.id} className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{reservation.guestName}</h3><span className="rounded-full bg-[var(--mandys-surface-muted)] px-2.5 py-1 text-xs font-medium">{c[reservation.status]}</span></div>
                  <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{dateFormatter.format(new Date(reservation.startsAt))} · {reservation.partySize} {c.partySize.toLowerCase()}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--mandys-foreground-muted)]">
                    {reservation.tableName ? <span>{c.table}: {reservation.tableName}</span> : null}{reservation.diningAreaName ? <span>{c.area}: {reservation.diningAreaName}</span> : null}<span>{c.source}: {reservation.source}</span>
                  </div>
                  {reservation.guestEmail || reservation.guestPhone ? <p className="mt-2 text-xs text-[var(--mandys-foreground-muted)]">{[reservation.guestEmail, reservation.guestPhone].filter(Boolean).join(" · ")}</p> : null}
                  {reservation.notes ? <p className="mt-3 text-sm leading-6">{reservation.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">{transitions[reservation.status].map(action => <Button key={action.status} variant="secondary" size="sm" disabled={busyReservationId === reservation.id} onClick={() => void changeStatus(reservation.id, action.status)}>{c[action.key]}</Button>)}</div>
              </div>
            </article>
          ))}</div>}
        </section>
      </div>
    </div>
  );
}
