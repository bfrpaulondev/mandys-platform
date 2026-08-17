"use client";

import type { Locale } from "@mandys/i18n";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createReservationTimeFormatter,
  restaurantDateInputValue,
} from "../../lib/reservation-time";

type Slot = {
  startsAt: string;
  endsAt: string;
  available: boolean;
  remainingCapacity: number;
};
type AvailabilityResponse = {
  data: {
    timezone: string;
    durationMinutes: number;
    maximumAdvanceDays: number;
    maximumPartySize: number;
    waitlistEnabled: boolean;
    slots: Slot[];
  };
};

type ErrorResponse = { error?: string; message?: string };

const copy = {
  "pt-PT": {
    name: "Nome",
    date: "Data",
    time: "Hora",
    guests: "Pessoas",
    email: "Email",
    phone: "Telefone",
    notes: "Observações",
    submit: "Pedir reserva",
    submitting: "A enviar…",
    success: "Pedido recebido. O restaurante irá confirmar a reserva.",
    unavailable: "As reservas reais ficam disponíveis quando este restaurante estiver configurado.",
    error: "Não foi possível enviar a reserva. Tente novamente.",
    loading: "A procurar horários…",
    noSlots: "Não existem horários disponíveis para esta data e número de pessoas.",
    choose: "Escolha um horário",
    waitlistSubmit: "Entrar na lista de espera",
    waitlistSubmitting: "A entrar…",
    waitlistSuccess: "Está na lista de espera. O restaurante poderá entrar em contacto se surgir disponibilidade.",
    waitlistAlready: "Já existe um pedido na lista de espera com estes dados para esta data.",
    slotsAvailable: "Entretanto existem horários disponíveis. Escolha um horário para reservar.",
    waitlistError: "Não foi possível entrar na lista de espera. Tente novamente.",
  },
  "pt-BR": {
    name: "Nome",
    date: "Data",
    time: "Horário",
    guests: "Pessoas",
    email: "E-mail",
    phone: "Telefone",
    notes: "Observações",
    submit: "Solicitar reserva",
    submitting: "Enviando…",
    success: "Pedido recebido. O restaurante irá confirmar a reserva.",
    unavailable: "As reservas reais ficam disponíveis quando este restaurante estiver configurado.",
    error: "Não foi possível enviar a reserva. Tente novamente.",
    loading: "Buscando horários…",
    noSlots: "Não há horários disponíveis para esta data e número de pessoas.",
    choose: "Escolha um horário",
    waitlistSubmit: "Entrar na lista de espera",
    waitlistSubmitting: "Entrando…",
    waitlistSuccess: "Você entrou na lista de espera. O restaurante poderá entrar em contato se surgir disponibilidade.",
    waitlistAlready: "Já existe um pedido na lista de espera com estes dados para esta data.",
    slotsAvailable: "Agora há horários disponíveis. Escolha um horário para reservar.",
    waitlistError: "Não foi possível entrar na lista de espera. Tente novamente.",
  },
  en: {
    name: "Name",
    date: "Date",
    time: "Time",
    guests: "Guests",
    email: "Email",
    phone: "Phone",
    notes: "Notes",
    submit: "Request booking",
    submitting: "Sending…",
    success: "Request received. The restaurant will confirm your booking.",
    unavailable: "Live bookings become available when this restaurant is configured.",
    error: "The booking request could not be sent. Please try again.",
    loading: "Finding available times…",
    noSlots: "There are no available times for this date and party size.",
    choose: "Choose a time",
    waitlistSubmit: "Join the waitlist",
    waitlistSubmitting: "Joining…",
    waitlistSuccess: "You are on the waitlist. The restaurant may contact you if a table becomes available.",
    waitlistAlready: "A waitlist request with these details already exists for this date.",
    slotsAvailable: "Times are now available. Choose a time to book instead.",
    waitlistError: "The waitlist request could not be sent. Please try again.",
  },
  es: {
    name: "Nombre",
    date: "Fecha",
    time: "Hora",
    guests: "Personas",
    email: "Email",
    phone: "Teléfono",
    notes: "Observaciones",
    submit: "Solicitar reserva",
    submitting: "Enviando…",
    success: "Solicitud recibida. El restaurante confirmará la reserva.",
    unavailable: "Las reservas reales estarán disponibles cuando este restaurante esté configurado.",
    error: "No se pudo enviar la reserva. Inténtalo de nuevo.",
    loading: "Buscando horarios…",
    noSlots: "No hay horarios disponibles para esta fecha y número de personas.",
    choose: "Elige un horario",
    waitlistSubmit: "Unirse a la lista de espera",
    waitlistSubmitting: "Uniéndote…",
    waitlistSuccess: "Estás en la lista de espera. El restaurante podrá contactarte si surge disponibilidad.",
    waitlistAlready: "Ya existe una solicitud en la lista de espera con estos datos para esta fecha.",
    slotsAvailable: "Ahora hay horarios disponibles. Elige un horario para reservar.",
    waitlistError: "No se pudo enviar la solicitud a la lista de espera. Inténtalo de nuevo.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const fieldClassName =
  "mt-1.5 min-h-12 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-background)] px-3 text-[var(--mandys-foreground)] outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

export function ReservationForm({
  locale,
  disabled,
  restaurantTimezone,
}: {
  locale: Locale;
  disabled: boolean;
  restaurantTimezone: string;
}) {
  const c = copy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const [timezone, setTimezone] = useState(restaurantTimezone);
  const [date, setDate] = useState(() => restaurantDateInputValue(restaurantTimezone, 1));
  const [partySize, setPartySize] = useState(2);
  const [maximumPartySize, setMaximumPartySize] = useState(100);
  const [maximumAdvanceDays, setMaximumAdvanceDays] = useState(365);
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(disabled ? c.unavailable : null);
  const [success, setSuccess] = useState(false);
  const timeFormatter = useMemo(
    () => createReservationTimeFormatter(locale, timezone),
    [locale, timezone],
  );
  const minimumDate = useMemo(() => restaurantDateInputValue(timezone), [timezone]);
  const maximumDate = useMemo(
    () => restaurantDateInputValue(timezone, maximumAdvanceDays),
    [maximumAdvanceDays, timezone],
  );

  useEffect(() => {
    if (disabled || !date || partySize < 1) return;
    let cancelled = false;
    setSlotLoading(true);
    setMessage(null);
    setSuccess(false);
    fetch(`/api/reservations?date=${encodeURIComponent(date)}&partySize=${partySize}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("availability_failed");
        return response.json() as Promise<AvailabilityResponse>;
      })
      .then((body) => {
        if (!cancelled) {
          const nextMaximumPartySize = Math.max(
            1,
            Math.min(100, body.data.maximumPartySize),
          );
          const nextMaximumAdvanceDays = Math.max(
            1,
            Math.min(365, body.data.maximumAdvanceDays),
          );
          setTimezone(body.data.timezone);
          setMaximumPartySize(nextMaximumPartySize);
          setMaximumAdvanceDays(nextMaximumAdvanceDays);
          setWaitlistEnabled(body.data.waitlistEnabled === true);
          setPartySize((current) => Math.min(current, nextMaximumPartySize));
          setSlots(body.data.slots.filter((slot) => slot.available));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setWaitlistEnabled(false);
          setMessage(c.error);
        }
      })
      .finally(() => {
        if (!cancelled) setSlotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [c.error, date, disabled, partySize]);

  async function submit(formData: FormData) {
    if (disabled) return;
    const startsAt = String(formData.get("startsAt") ?? "");
    if (!startsAt) {
      setMessage(c.noSlots);
      return;
    }
    setSubmitting(true);
    setMessage(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt,
          partySize,
          locale,
          guestName: String(formData.get("guestName") ?? ""),
          ...(formData.get("guestEmail")
            ? { guestEmail: String(formData.get("guestEmail")) }
            : {}),
          ...(formData.get("guestPhone")
            ? { guestPhone: String(formData.get("guestPhone")) }
            : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ErrorResponse;
        if (body.error === "SLOT_UNAVAILABLE") {
          setMessage(c.noSlots);
          setSlots((current) => current.filter((slot) => slot.startsAt !== startsAt));
          return;
        }
        throw new Error("reservation_failed");
      }
      formRef.current?.reset();
      setSuccess(true);
      setMessage(c.success);
      setSlots((current) => current.filter((slot) => slot.startsAt !== startsAt));
    } catch {
      setSuccess(false);
      setMessage(c.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function joinWaitlist() {
    if (disabled || !formRef.current || !formRef.current.reportValidity()) return;
    const formData = new FormData(formRef.current);
    setWaitlistSubmitting(true);
    setMessage(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/reservations/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestedDate: date,
          partySize,
          locale,
          guestName: String(formData.get("guestName") ?? ""),
          ...(formData.get("guestEmail")
            ? { guestEmail: String(formData.get("guestEmail")) }
            : {}),
          ...(formData.get("guestPhone")
            ? { guestPhone: String(formData.get("guestPhone")) }
            : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as ErrorResponse;
      if (!response.ok) {
        if (body.error === "SLOTS_AVAILABLE") {
          setMessage(c.slotsAvailable);
          return;
        }
        if (body.error === "ALREADY_WAITLISTED") {
          setSuccess(true);
          setMessage(c.waitlistAlready);
          return;
        }
        throw new Error("waitlist_failed");
      }

      setSuccess(true);
      setMessage(c.waitlistSuccess);
    } catch {
      setSuccess(false);
      setMessage(c.waitlistError);
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  const busy = submitting || waitlistSubmitting;
  const showWaitlist = !disabled && !slotLoading && slots.length === 0 && waitlistEnabled;

  return (
    <form
      ref={formRef}
      action={submit}
      data-testid="storefront-reservation-form"
      className="grid gap-4 sm:grid-cols-2"
    >
      <label className="block text-sm font-medium">
        {c.name}
        <input
          name="guestName"
          autoComplete="name"
          data-testid="reservation-guest-name"
          required
          minLength={2}
          maxLength={120}
          disabled={disabled}
          className={fieldClassName}
        />
      </label>
      <label className="block text-sm font-medium">
        {c.guests}
        <input
          name="partySize"
          data-testid="reservation-party-size"
          type="number"
          min={1}
          max={maximumPartySize}
          value={partySize}
          onChange={(event) =>
            setPartySize(
              Math.max(1, Math.min(maximumPartySize, Number(event.target.value) || 1)),
            )
          }
          required
          disabled={disabled}
          className={fieldClassName}
        />
      </label>
      <label className="block text-sm font-medium">
        {c.date}
        <input
          name="date"
          data-testid="reservation-date"
          type="date"
          min={minimumDate}
          max={maximumDate}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
          disabled={disabled}
          className={fieldClassName}
        />
      </label>
      <label className="block text-sm font-medium">
        {c.time}
        <select
          name="startsAt"
          data-testid="reservation-starts-at"
          required
          disabled={disabled || slotLoading || slots.length === 0}
          className={fieldClassName}
          defaultValue=""
        >
          <option value="">{slotLoading ? c.loading : c.choose}</option>
          {slots.map((slot) => (
            <option key={slot.startsAt} value={slot.startsAt}>
              {timeFormatter.format(new Date(slot.startsAt))}
            </option>
          ))}
        </select>
      </label>
      {!disabled && !slotLoading && slots.length === 0 ? (
        <p className="sm:col-span-2 text-sm text-[var(--mandys-foreground-muted)]">
          {c.noSlots}
        </p>
      ) : null}
      <label className="block text-sm font-medium">
        {c.email}
        <input
          name="guestEmail"
          data-testid="reservation-email"
          type="email"
          autoComplete="email"
          disabled={disabled}
          className={fieldClassName}
        />
      </label>
      <label className="block text-sm font-medium">
        {c.phone}
        <input
          name="guestPhone"
          data-testid="reservation-phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          disabled={disabled}
          className={fieldClassName}
        />
      </label>
      <label className="block text-sm font-medium sm:col-span-2">
        {c.notes}
        <textarea
          name="notes"
          data-testid="reservation-notes"
          rows={3}
          maxLength={2000}
          disabled={disabled}
          className={`${fieldClassName} py-3`}
        />
      </label>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          data-testid="reservation-submit"
          disabled={disabled || busy || slots.length === 0}
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-5 text-sm font-semibold text-[var(--mandys-accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? c.submitting : c.submit}
        </button>
        {showWaitlist ? (
          <button
            type="button"
            data-testid="waitlist-submit"
            disabled={busy}
            onClick={() => void joinWaitlist()}
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] px-5 text-sm font-semibold transition hover:bg-[var(--mandys-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {waitlistSubmitting ? c.waitlistSubmitting : c.waitlistSubmit}
          </button>
        ) : null}
        {message ? (
          <p
            role="status"
            data-testid="reservation-status"
            data-state={success ? "success" : disabled ? "disabled" : "error"}
            className={`basis-full text-sm leading-6 ${
              success
                ? "text-[var(--mandys-foreground)]"
                : "text-[var(--mandys-foreground-muted)]"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
