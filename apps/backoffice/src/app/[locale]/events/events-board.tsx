"use client";

import type { EventLeadStatus, Locale } from "@mandys/contracts";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

type EventLead = {
  id: string;
  status: EventLeadStatus;
  eventType: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  eventAt: string | null;
  partySize: number | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  notes: string | null;
};

type EventsResponse = { data: EventLead[] };
type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": {
    subtitle: "Transforme pedidos de grupos, aniversários e eventos numa pipeline acompanhável.",
    newLead: "Novo pedido",
    eventType: "Tipo de evento",
    contactName: "Contacto",
    email: "Email",
    phone: "Telefone",
    eventAt: "Data e hora",
    partySize: "Pessoas",
    budgetMin: "Orçamento mín. (€)",
    budgetMax: "Orçamento máx. (€)",
    notes: "Observações",
    create: "Criar pedido",
    creating: "A criar…",
    pipeline: "Pipeline de eventos",
    empty: "Ainda não existem pedidos de eventos.",
    loading: "A carregar eventos…",
    refresh: "Atualizar",
    apiMissing: "O Backoffice está publicado, mas a API ainda não está configurada neste ambiente.",
    new: "Novo",
    contacted: "Contactado",
    proposal_sent: "Proposta enviada",
    deposit_pending: "Sinal pendente",
    confirmed: "Confirmado",
    completed: "Concluído",
    lost: "Perdido",
    contact: "Marcar contactado",
    proposal: "Proposta enviada",
    deposit: "Aguardar sinal",
    confirm: "Confirmar",
    complete: "Concluir",
    lose: "Marcar perdido",
  },
  "pt-BR": {
    subtitle: "Transforme pedidos de grupos, aniversários e eventos em um pipeline acompanhável.",
    newLead: "Novo pedido",
    eventType: "Tipo de evento",
    contactName: "Contato",
    email: "Email",
    phone: "Telefone",
    eventAt: "Data e hora",
    partySize: "Pessoas",
    budgetMin: "Orçamento mín. (€)",
    budgetMax: "Orçamento máx. (€)",
    notes: "Observações",
    create: "Criar pedido",
    creating: "Criando…",
    pipeline: "Pipeline de eventos",
    empty: "Ainda não existem pedidos de eventos.",
    loading: "Carregando eventos…",
    refresh: "Atualizar",
    apiMissing: "O Backoffice está publicado, mas a API ainda não está configurada neste ambiente.",
    new: "Novo",
    contacted: "Contatado",
    proposal_sent: "Proposta enviada",
    deposit_pending: "Sinal pendente",
    confirmed: "Confirmado",
    completed: "Concluído",
    lost: "Perdido",
    contact: "Marcar contatado",
    proposal: "Proposta enviada",
    deposit: "Aguardar sinal",
    confirm: "Confirmar",
    complete: "Concluir",
    lose: "Marcar perdido",
  },
  en: {
    subtitle: "Turn group, birthday and event enquiries into a pipeline the team can follow.",
    newLead: "New enquiry",
    eventType: "Event type",
    contactName: "Contact",
    email: "Email",
    phone: "Phone",
    eventAt: "Date and time",
    partySize: "Guests",
    budgetMin: "Min. budget (€)",
    budgetMax: "Max. budget (€)",
    notes: "Notes",
    create: "Create enquiry",
    creating: "Creating…",
    pipeline: "Events pipeline",
    empty: "There are no event enquiries yet.",
    loading: "Loading events…",
    refresh: "Refresh",
    apiMissing: "The Backoffice is deployed, but the API is not configured in this environment yet.",
    new: "New",
    contacted: "Contacted",
    proposal_sent: "Proposal sent",
    deposit_pending: "Deposit pending",
    confirmed: "Confirmed",
    completed: "Completed",
    lost: "Lost",
    contact: "Mark contacted",
    proposal: "Proposal sent",
    deposit: "Await deposit",
    confirm: "Confirm",
    complete: "Complete",
    lose: "Mark lost",
  },
  es: {
    subtitle: "Convierte solicitudes de grupos, cumpleaños y eventos en un pipeline controlable.",
    newLead: "Nueva solicitud",
    eventType: "Tipo de evento",
    contactName: "Contacto",
    email: "Email",
    phone: "Teléfono",
    eventAt: "Fecha y hora",
    partySize: "Personas",
    budgetMin: "Presupuesto mín. (€)",
    budgetMax: "Presupuesto máx. (€)",
    notes: "Observaciones",
    create: "Crear solicitud",
    creating: "Creando…",
    pipeline: "Pipeline de eventos",
    empty: "Todavía no existen solicitudes de eventos.",
    loading: "Cargando eventos…",
    refresh: "Actualizar",
    apiMissing: "El Backoffice está publicado, pero la API todavía no está configurada en este entorno.",
    new: "Nuevo",
    contacted: "Contactado",
    proposal_sent: "Propuesta enviada",
    deposit_pending: "Señal pendiente",
    confirmed: "Confirmado",
    completed: "Completado",
    lost: "Perdido",
    contact: "Marcar contactado",
    proposal: "Propuesta enviada",
    deposit: "Esperar señal",
    confirm: "Confirmar",
    complete: "Completar",
    lose: "Marcar perdido",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const transitions: Record<
  EventLeadStatus,
  Array<{ status: EventLeadStatus; key: "contact" | "proposal" | "deposit" | "confirm" | "complete" | "lose" }>
> = {
  new: [
    { status: "contacted", key: "contact" },
    { status: "lost", key: "lose" },
  ],
  contacted: [
    { status: "proposal_sent", key: "proposal" },
    { status: "lost", key: "lose" },
  ],
  proposal_sent: [
    { status: "deposit_pending", key: "deposit" },
    { status: "confirmed", key: "confirm" },
    { status: "lost", key: "lose" },
  ],
  deposit_pending: [
    { status: "confirmed", key: "confirm" },
    { status: "lost", key: "lose" },
  ],
  confirmed: [
    { status: "completed", key: "complete" },
    { status: "lost", key: "lose" },
  ],
  completed: [],
  lost: [],
};

const fieldClassName =
  "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  return body.message ?? `Request failed (${response.status})`;
}

function centsFromForm(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

export function EventsBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [leads, setLeads] = useState<EventLead[]>([]);
  const [loading, setLoading] = useState(Boolean(apiBaseUrl));
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(apiBaseUrl ? null : c.apiMissing);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const moneyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }),
    [locale],
  );

  const load = useCallback(async () => {
    if (!apiBaseUrl) {
      setError(c.apiMissing);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/events?limit=200`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as EventsResponse;
      setLeads(body.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [c.apiMissing]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLead(formData: FormData) {
    if (!apiBaseUrl) {
      setError(c.apiMissing);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const eventAtRaw = String(formData.get("eventAt") ?? "").trim();
      const response = await fetch(`${apiBaseUrl}/v1/events`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: String(formData.get("eventType") ?? ""),
          contactName: String(formData.get("contactName") ?? ""),
          ...(formData.get("contactEmail") ? { contactEmail: String(formData.get("contactEmail")) } : {}),
          ...(formData.get("contactPhone") ? { contactPhone: String(formData.get("contactPhone")) } : {}),
          ...(eventAtRaw ? { eventAt: new Date(eventAtRaw).toISOString() } : {}),
          ...(formData.get("partySize") ? { partySize: Number(formData.get("partySize")) } : {}),
          ...(centsFromForm(formData.get("budgetMin")) !== undefined
            ? { budgetMinCents: centsFromForm(formData.get("budgetMin")) }
            : {}),
          ...(centsFromForm(formData.get("budgetMax")) !== undefined
            ? { budgetMaxCents: centsFromForm(formData.get("budgetMax")) }
            : {}),
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

  async function changeStatus(eventLeadId: string, status: EventLeadStatus) {
    if (!apiBaseUrl) return;
    setBusyId(eventLeadId);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/events/${eventLeadId}/status`, {
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
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <aside className="h-fit rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
        <h2 className="text-lg font-semibold">{c.newLead}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
        <form action={createLead} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            {c.eventType}
            <input name="eventType" required minLength={2} maxLength={120} className={fieldClassName} />
          </label>
          <label className="block text-sm font-medium">
            {c.contactName}
            <input name="contactName" required minLength={2} maxLength={160} className={fieldClassName} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="block text-sm font-medium">
              {c.email}
              <input name="contactEmail" type="email" className={fieldClassName} />
            </label>
            <label className="block text-sm font-medium">
              {c.phone}
              <input name="contactPhone" maxLength={40} className={fieldClassName} />
            </label>
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <label className="block text-sm font-medium">
              {c.eventAt}
              <input name="eventAt" type="datetime-local" className={fieldClassName} />
            </label>
            <label className="block text-sm font-medium">
              {c.partySize}
              <input name="partySize" type="number" min={1} max={10000} className={fieldClassName} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              {c.budgetMin}
              <input name="budgetMin" type="number" min="0" step="0.01" className={fieldClassName} />
            </label>
            <label className="block text-sm font-medium">
              {c.budgetMax}
              <input name="budgetMax" type="number" min="0" step="0.01" className={fieldClassName} />
            </label>
          </div>
          <label className="block text-sm font-medium">
            {c.notes}
            <textarea name="notes" rows={3} maxLength={4000} className={`${fieldClassName} py-2`} />
          </label>
          <Button type="submit" className="w-full" disabled={submitting || !apiBaseUrl}>
            {submitting ? c.creating : c.create}
          </Button>
        </form>
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{c.pipeline}</h2>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {c.refresh}
          </Button>
        </div>

        {error ? (
          <div className="mb-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 text-sm text-[var(--mandys-foreground-muted)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">
            {c.loading}
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">
            {c.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <article key={lead.id} className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{lead.eventType}</h3>
                      <span className="rounded-full bg-[var(--mandys-surface-muted)] px-2.5 py-1 text-xs font-medium">
                        {c[lead.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">
                      {lead.contactName}
                      {lead.partySize ? ` · ${lead.partySize} ${c.partySize.toLowerCase()}` : ""}
                      {lead.eventAt ? ` · ${dateFormatter.format(new Date(lead.eventAt))}` : ""}
                    </p>
                    {lead.budgetMinCents !== null || lead.budgetMaxCents !== null ? (
                      <p className="mt-2 text-sm">
                        {lead.budgetMinCents !== null ? moneyFormatter.format(lead.budgetMinCents / 100) : "—"}
                        {" – "}
                        {lead.budgetMaxCents !== null ? moneyFormatter.format(lead.budgetMaxCents / 100) : "—"}
                      </p>
                    ) : null}
                    {lead.notes ? <p className="mt-2 text-sm leading-6">{lead.notes}</p> : null}
                  </div>

                  {transitions[lead.status].length > 0 ? (
                    <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                      {transitions[lead.status].map((action) => (
                        <Button
                          key={action.status}
                          size="sm"
                          variant={action.status === "lost" ? "secondary" : "primary"}
                          disabled={busyId === lead.id}
                          onClick={() => void changeStatus(lead.id, action.status)}
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
