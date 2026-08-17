"use client";

import type { Locale } from "@mandys/i18n";
import { useRef, useState } from "react";

const copy = {
  "pt-PT": {
    type: "Tipo de evento", name: "Nome", email: "Email", phone: "Telefone", date: "Data e hora pretendida", guests: "Pessoas",
    budget: "Orçamento aproximado (€)", notes: "Conte-nos o que está a planear", submit: "Pedir proposta", submitting: "A enviar…",
    success: "Pedido recebido. A equipa do restaurante poderá acompanhá-lo diretamente no Mandy's.", error: "Não foi possível enviar o pedido. Tente novamente.",
    typePlaceholder: "Aniversário, jantar de grupo, empresa…",
  },
  "pt-BR": {
    type: "Tipo de evento", name: "Nome", email: "E-mail", phone: "Telefone", date: "Data e horário desejados", guests: "Pessoas",
    budget: "Orçamento aproximado (€)", notes: "Conte o que está planejando", submit: "Solicitar proposta", submitting: "Enviando…",
    success: "Pedido recebido. A equipe do restaurante poderá acompanhá-lo diretamente no Mandy's.", error: "Não foi possível enviar o pedido. Tente novamente.",
    typePlaceholder: "Aniversário, jantar em grupo, empresa…",
  },
  en: {
    type: "Event type", name: "Name", email: "Email", phone: "Phone", date: "Preferred date and time", guests: "Guests",
    budget: "Approx. budget (€)", notes: "Tell us what you are planning", submit: "Request a proposal", submitting: "Sending…",
    success: "Enquiry received. The restaurant team can now follow it directly in Mandy's.", error: "The enquiry could not be sent. Please try again.",
    typePlaceholder: "Birthday, group dinner, company event…",
  },
  es: {
    type: "Tipo de evento", name: "Nombre", email: "Email", phone: "Teléfono", date: "Fecha y hora preferidas", guests: "Personas",
    budget: "Presupuesto aproximado (€)", notes: "Cuéntanos qué estás planeando", submit: "Solicitar propuesta", submitting: "Enviando…",
    success: "Solicitud recibida. El equipo del restaurante podrá gestionarla directamente en Mandy's.", error: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
    typePlaceholder: "Cumpleaños, cena de grupo, empresa…",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const fieldClassName = "mt-1.5 min-h-12 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-background)] px-3 text-[var(--mandys-foreground)] outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

export function EventInquiryForm({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(formData: FormData) {
    setSubmitting(true); setMessage(null); setSuccess(false);
    try {
      const eventAtRaw = String(formData.get("eventAt") ?? "").trim();
      const budgetRaw = String(formData.get("budget") ?? "").trim();
      const budget = budgetRaw ? Number(budgetRaw.replace(",", ".")) : null;
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: String(formData.get("eventType") ?? ""),
          contactName: String(formData.get("contactName") ?? ""),
          ...(formData.get("contactEmail") ? { contactEmail: String(formData.get("contactEmail")) } : {}),
          ...(formData.get("contactPhone") ? { contactPhone: String(formData.get("contactPhone")) } : {}),
          ...(eventAtRaw ? { eventAt: new Date(eventAtRaw).toISOString() } : {}),
          ...(formData.get("partySize") ? { partySize: Number(formData.get("partySize")) } : {}),
          ...(budget !== null && Number.isFinite(budget) ? { budgetMaxCents: Math.round(budget * 100) } : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
        }),
      });
      if (!response.ok) throw new Error("event_enquiry_failed");
      formRef.current?.reset(); setSuccess(true); setMessage(c.success);
    } catch {
      setSuccess(false); setMessage(c.error);
    } finally { setSubmitting(false); }
  }

  return (
    <form ref={formRef} action={submit} data-testid="storefront-event-form" className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium sm:col-span-2">{c.type}<input name="eventType" data-testid="event-type" required minLength={2} maxLength={120} placeholder={c.typePlaceholder} className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.name}<input name="contactName" data-testid="event-contact-name" autoComplete="name" required minLength={2} maxLength={160} className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.email}<input name="contactEmail" data-testid="event-email" type="email" autoComplete="email" className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.phone}<input name="contactPhone" data-testid="event-phone" type="tel" maxLength={40} autoComplete="tel" className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.date}<input name="eventAt" data-testid="event-at" type="datetime-local" className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.guests}<input name="partySize" data-testid="event-party-size" type="number" min={1} max={10000} className={fieldClassName} /></label>
      <label className="block text-sm font-medium">{c.budget}<input name="budget" data-testid="event-budget" type="number" min="0" step="0.01" className={fieldClassName} /></label>
      <label className="block text-sm font-medium sm:col-span-2">{c.notes}<textarea name="notes" data-testid="event-notes" rows={4} maxLength={4000} className={`${fieldClassName} py-3`} /></label>
      <div className="sm:col-span-2"><button type="submit" data-testid="event-submit" disabled={submitting} className="inline-flex min-h-12 items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-5 text-sm font-semibold text-[var(--mandys-accent-foreground)] transition hover:brightness-95 disabled:opacity-50">{submitting ? c.submitting : c.submit}</button>{message ? <p role="status" data-testid="event-status" data-state={success ? "success" : "error"} className="mt-3 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{message}</p> : null}</div>
    </form>
  );
}
