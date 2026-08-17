"use client";

import type { Locale } from "@mandys/i18n";
import { useEffect, useMemo, useRef, useState } from "react";

import { createReservationTimeFormatter } from "../../lib/reservation-time";

type Slot = { startsAt: string; endsAt: string; available: boolean; remainingCapacity: number };
type AvailabilityResponse = { data: { timezone: string; durationMinutes: number; slots: Slot[] } };

type ErrorResponse = { error?: string; message?: string };

const copy = {
  "pt-PT": {
    name: "Nome", date: "Data", time: "Hora", guests: "Pessoas", email: "Email", phone: "Telefone", notes: "Observações",
    submit: "Pedir reserva", submitting: "A enviar…", success: "Pedido recebido. O restaurante irá confirmar a reserva.",
    unavailable: "As reservas reais ficam disponíveis quando este restaurante estiver configurado.", error: "Não foi possível enviar a reserva. Tente novamente.",
    loading: "A procurar horários…", noSlots: "Não existem horários disponíveis para esta data e número de pessoas.", choose: "Escolha um horário", full: "lotação esgotada",
  },
  "pt-BR": {
    name: "Nome", date: "Data", time: "Horário", guests: "Pessoas", email: "E-mail", phone: "Telefone", notes: "Observações",
    submit: "Solicitar reserva", submitting: "Enviando…", success: "Pedido recebido. O restaurante irá confirmar a reserva.",
    unavailable: "As reservas reais ficam disponíveis quando este restaurante estiver configurado.", error: "Não foi possível enviar a reserva. Tente novamente.",
    loading: "Buscando horários…", noSlots: "Não há horários disponíveis para esta data e número de pessoas.", choose: "Escolha um horário", full: "lotação esgotada",
  },
  en: {
    name: "Name", date: "Date", time: "Time", guests: "Guests", email: "Email", phone: "Phone", notes: "Notes",
    submit: "Request booking", submitting: "Sending…", success: "Request received. The restaurant will confirm your booking.",
    unavailable: "Live bookings become available when this restaurant is configured.", error: "The booking request could not be sent. Please try again.",
    loading: "Finding available times…", noSlots: "There are no available times for this date and party size.", choose: "Choose a time", full: "fully booked",
  },
  es: {
    name: "Nombre", date: "Fecha", time: "Hora", guests: "Personas", email: "Email", phone: "Teléfono", notes: "Observaciones",
    submit: "Solicitar reserva", submitting: "Enviando…", success: "Solicitud recibida. El restaurante confirmará la reserva.",
    unavailable: "Las reservas reales estarán disponibles cuando este restaurante esté configurado.", error: "No se pudo enviar la reserva. Inténtalo de nuevo.",
    loading: "Buscando horarios…", noSlots: "No hay horarios disponibles para esta fecha y número de personas.", choose: "Elige un horario", full: "aforo completo",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const fieldClassName = "mt-1.5 min-h-12 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-background)] px-3 text-[var(--mandys-foreground)] outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

function dateInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ReservationForm({ locale, disabled }: { locale: Locale; disabled: boolean }) {
  const c = copy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState(dateInputValue(1));
  const [partySize, setPartySize] = useState(2);
  const [timezone, setTimezone] = useState("UTC");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(disabled ? c.unavailable : null);
  const [success, setSuccess] = useState(false);
  const timeFormatter = useMemo(
    () => createReservationTimeFormatter(locale, timezone),
    [locale, timezone],
  );

  useEffect(() => {
    if (disabled || !date || partySize < 1) return;
    let cancelled = false;
    setSlotLoading(true);
    setMessage(null);
    fetch(`/api/reservations?date=${encodeURIComponent(date)}&partySize=${partySize}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("availability_failed");
        return response.json() as Promise<AvailabilityResponse>;
      })
      .then(body => {
        if (!cancelled) {
          setTimezone(body.data.timezone);
          setSlots(body.data.slots.filter(slot => slot.available));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setMessage(c.error);
        }
      })
      .finally(() => { if (!cancelled) setSlotLoading(false); });
    return () => { cancelled = true; };
  }, [c.error, date, disabled, partySize]);

  async function submit(formData: FormData) {
    if (disabled) return;
    const startsAt = String(formData.get("startsAt") ?? "");
    if (!startsAt) { setMessage(c.noSlots); return; }
    setSubmitting(true); setMessage(null); setSuccess(false);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt, partySize, locale,
          guestName: String(formData.get("guestName") ?? ""),
          ...(formData.get("guestEmail") ? { guestEmail: String(formData.get("guestEmail")) } : {}),
          ...(formData.get("guestPhone") ? { guestPhone: String(formData.get("guestPhone")) } : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ErrorResponse;
        if (body.error === "SLOT_UNAVAILABLE") {
          setMessage(c.noSlots);
          setSlots(current => current.filter(slot => slot.startsAt !== startsAt));
          return;
        }
        throw new Error("reservation_failed");
      }
      formRef.current?.reset();
      setSuccess(true); setMessage(c.success);
      setSlots(current => current.filter(slot => slot.startsAt !== startsAt));
    } catch {
      setSuccess(false); setMessage(c.error);
    } finally { setSubmitting(false); }
  }

  return (
    <form ref={formRef} action={submit} data-testid="storefront-reservation-form" className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">{c.name}<input name="guestName" autoComplete="name" data-testid="reservation-guest-name" required minLength={2} maxLength={120} disabled={disabled} className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.guests}<input name="partySize" data-testid="reservation-party-size" type="number" min={1} max={100} value={partySize} onChange={event => setPartySize(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} required disabled={disabled} className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.date}<input name="date" data-testid="reservation-date" type="date" min={dateInputValue()} max={dateInputValue(365)} value={date} onChange={event => setDate(event.target.value)} required disabled={disabled} className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.time}
        <select name="startsAt" data-testid="reservation-starts-at" required disabled={disabled || slotLoading || slots.length === 0} className={fieldClassName} defaultValue="">
          <option value="">{slotLoading ? c.loading : c.choose}</option>
          {slots.map(slot => <option key={slot.startsAt} value={slot.startsAt}>{timeFormatter.format(new Date(slot.startsAt))}</option>)}
        </select>
      </label>
      {!disabled && !slotLoading && slots.length === 0 ? <p className="sm:col-span-2 text-sm text-[var(--mandys-foreground-muted)]">{c.noSlots}</p> : null}
      <label className="block text-sm font-medium">{c.email}<input name="guestEmail" data-testid="reservation-email" type="email" autoComplete="email" disabled={disabled} className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.phone}<input name="guestPhone" data-testid="reservation-phone" type="tel" autoComplete="tel" maxLength={40} disabled={disabled} className={fieldClassName} /></label>
      <label className="block text-sm font-medium sm:col-span-2">{c.notes}<textarea name="notes" data-testid="reservation-notes" rows={3} maxLength={2000} disabled={disabled} className={`${fieldClassName} py-3`} /></label>
      <div className="sm:col-span-2">
        <button type="submit" data-testid="reservation-submit" disabled={disabled || submitting || slots.length === 0} className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-5 text-sm font-semibold text-[var(--mandys-accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? c.submitting : c.submit}</button>
        {message ? <p role="status" data-testid="reservation-status" data-state={success ? "success" : disabled ? "disabled" : "error"} className={`mt-3 text-sm leading-6 ${success ? "text-[var(--mandys-foreground)]" : "text-[var(--mandys-foreground-muted)]"}`}>{message}</p> : null}
      </div>
    </form>
  );
}
