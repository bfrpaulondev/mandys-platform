"use client";

import type { Locale } from "@mandys/i18n";
import { useRef, useState } from "react";

const copy = {
  "pt-PT": {
    name: "Nome",
    date: "Data e hora",
    guests: "Pessoas",
    email: "Email",
    phone: "Telefone",
    notes: "Observações",
    submit: "Pedir reserva",
    submitting: "A enviar…",
    success: "Pedido recebido. O restaurante irá confirmar a reserva.",
    unavailable: "As reservas reais ficam disponíveis quando este demo estiver ligado a um restaurante configurado.",
    error: "Não foi possível enviar a reserva. Tente novamente.",
  },
  "pt-BR": {
    name: "Nome",
    date: "Data e hora",
    guests: "Pessoas",
    email: "Email",
    phone: "Telefone",
    notes: "Observações",
    submit: "Solicitar reserva",
    submitting: "Enviando…",
    success: "Pedido recebido. O restaurante irá confirmar a reserva.",
    unavailable: "As reservas reais ficam disponíveis quando esta demo estiver conectada a um restaurante configurado.",
    error: "Não foi possível enviar a reserva. Tente novamente.",
  },
  en: {
    name: "Name",
    date: "Date and time",
    guests: "Guests",
    email: "Email",
    phone: "Phone",
    notes: "Notes",
    submit: "Request booking",
    submitting: "Sending…",
    success: "Request received. The restaurant will confirm your booking.",
    unavailable: "Live bookings become available when this demo is connected to a configured restaurant.",
    error: "The booking request could not be sent. Please try again.",
  },
  es: {
    name: "Nombre",
    date: "Fecha y hora",
    guests: "Personas",
    email: "Email",
    phone: "Teléfono",
    notes: "Observaciones",
    submit: "Solicitar reserva",
    submitting: "Enviando…",
    success: "Solicitud recibida. El restaurante confirmará la reserva.",
    unavailable: "Las reservas reales estarán disponibles cuando esta demo esté conectada a un restaurante configurado.",
    error: "No se pudo enviar la reserva. Inténtalo de nuevo.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const fieldClassName =
  "mt-1.5 min-h-12 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-background)] px-3 text-[var(--mandys-foreground)] outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

export function ReservationForm({ locale, disabled }: { locale: Locale; disabled: boolean }) {
  const c = copy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(disabled ? c.unavailable : null);
  const [success, setSuccess] = useState(false);

  async function submit(formData: FormData) {
    if (disabled) return;
    setSubmitting(true);
    setMessage(null);
    setSuccess(false);

    try {
      const startsAtRaw = String(formData.get("startsAt") ?? "");
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt: new Date(startsAtRaw).toISOString(),
          partySize: Number(formData.get("partySize") ?? 2),
          guestName: String(formData.get("guestName") ?? ""),
          ...(formData.get("guestEmail") ? { guestEmail: String(formData.get("guestEmail")) } : {}),
          ...(formData.get("guestPhone") ? { guestPhone: String(formData.get("guestPhone")) } : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
        }),
      });

      if (!response.ok) throw new Error("reservation_failed");
      formRef.current?.reset();
      setSuccess(true);
      setMessage(c.success);
    } catch {
      setSuccess(false);
      setMessage(c.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} action={submit} data-testid="storefront-reservation-form" className="grid gap-4 sm:grid-cols-2">
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
        {c.date}
        <input
          name="startsAt"
          data-testid="reservation-starts-at"
          type="datetime-local"
          required
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
          max={100}
          defaultValue={2}
          required
          disabled={disabled}
          className={fieldClassName}
        />
      </label>
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
      <div className="sm:col-span-2">
        <button
          type="submit"
          data-testid="reservation-submit"
          disabled={disabled || submitting}
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-5 text-sm font-semibold text-[var(--mandys-accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? c.submitting : c.submit}
        </button>
        {message ? (
          <p
            role="status"
            data-testid="reservation-status"
            data-state={success ? "success" : disabled ? "disabled" : "error"}
            className={`mt-3 text-sm leading-6 ${success ? "text-[var(--mandys-foreground)]" : "text-[var(--mandys-foreground-muted)]"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
