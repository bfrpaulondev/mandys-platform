"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type WaitlistStatus = "waiting" | "contacted" | "converted" | "cancelled" | "expired";
type WaitlistEntry = { id: string; requestedDate: string; preferredStartsAt: string | null; preferredEndsAt: string | null; partySize: number; guestName: string; guestEmail: string | null; guestPhone: string | null; notes: string | null; status: WaitlistStatus; source: string; createdAt: string; updatedAt: string };
type WaitlistResponse = { data: WaitlistEntry[] };
type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": { title: "Lista de espera", help: "Pedidos sem horário disponível ficam aqui para a equipa recuperar oportunidades quando surgir uma mesa.", waiting: "A aguardar", contacted: "Contactado", converted: "Convertido", cancelled: "Cancelado", expired: "Expirado", empty: "A lista de espera está vazia.", loading: "A carregar lista de espera…", refresh: "Atualizar", markContacted: "Contactado", markConverted: "Convertido em reserva", cancel: "Cancelar", expire: "Expirar", people: "pessoas", received: "Recebido" },
  "pt-BR": { title: "Lista de espera", help: "Pedidos sem horário disponível ficam aqui para a equipe recuperar oportunidades quando surgir uma mesa.", waiting: "Aguardando", contacted: "Contatado", converted: "Convertido", cancelled: "Cancelado", expired: "Expirado", empty: "A lista de espera está vazia.", loading: "Carregando lista de espera…", refresh: "Atualizar", markContacted: "Contatado", markConverted: "Convertido em reserva", cancel: "Cancelar", expire: "Expirar", people: "pessoas", received: "Recebido" },
  en: { title: "Waitlist", help: "Requests without an available slot stay here so the team can recover demand when a table opens up.", waiting: "Waiting", contacted: "Contacted", converted: "Converted", cancelled: "Cancelled", expired: "Expired", empty: "The waitlist is empty.", loading: "Loading waitlist…", refresh: "Refresh", markContacted: "Contacted", markConverted: "Converted to booking", cancel: "Cancel", expire: "Expire", people: "guests", received: "Received" },
  es: { title: "Lista de espera", help: "Las solicitudes sin horario disponible quedan aquí para recuperar oportunidades cuando se libere una mesa.", waiting: "En espera", contacted: "Contactado", converted: "Convertido", cancelled: "Cancelado", expired: "Expirado", empty: "La lista de espera está vacía.", loading: "Cargando lista de espera…", refresh: "Actualizar", markContacted: "Contactado", markConverted: "Convertido en reserva", cancel: "Cancelar", expire: "Expirar", people: "personas", received: "Recibido" },
} as const satisfies Record<Locale, Record<string, string>>;

async function readError(response: Response) { const body = (await response.json().catch(() => ({}))) as ErrorResponse; return body.message ?? `Request failed (${response.status})`; }

export function WaitlistPanel({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }), [locale]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/reservations/v1/waitlist", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as WaitlistResponse;
      setEntries(body.data);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unexpected error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(id: string, status: WaitlistStatus) {
    setBusyId(id); setError(null);
    try {
      const response = await fetch(`/api/reservations/v1/waitlist/${id}/status`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (statusError) { setError(statusError instanceof Error ? statusError.message : "Unexpected error"); }
    finally { setBusyId(null); }
  }

  const active = entries.filter((entry) => entry.status === "waiting" || entry.status === "contacted");

  return (
    <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-semibold">{c.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.help}</p></div><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{c.refresh}</Button></div>
      {error ? <p className="mt-4 rounded-md bg-[var(--mandys-surface-muted)] p-3 text-sm text-[var(--mandys-foreground-muted)]">{error}</p> : null}
      {loading ? <p className="mt-5 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</p>
      : active.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-[var(--mandys-border)] p-5 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</p>
      : <div className="mt-5 space-y-3">{active.map((entry) => <article key={entry.id} className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{entry.guestName}</h3><span className="rounded-full bg-[var(--mandys-surface-muted)] px-2 py-1 text-xs">{c[entry.status]}</span></div><p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{dateFormatter.format(new Date(`${entry.requestedDate}T12:00:00`))} · {entry.partySize} {c.people}{entry.preferredStartsAt ? ` · ${entry.preferredStartsAt}${entry.preferredEndsAt ? `–${entry.preferredEndsAt}` : ""}` : ""}</p>{entry.guestEmail || entry.guestPhone ? <p className="mt-2 text-xs text-[var(--mandys-foreground-muted)]">{[entry.guestEmail, entry.guestPhone].filter(Boolean).join(" · ")}</p> : null}{entry.notes ? <p className="mt-2 text-sm leading-6">{entry.notes}</p> : null}<p className="mt-2 text-[11px] text-[var(--mandys-foreground-muted)]">{c.received}: {dateTimeFormatter.format(new Date(entry.createdAt))} · {entry.source}</p></div>
            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">{entry.status === "waiting" ? <Button size="sm" variant="secondary" disabled={busyId === entry.id} onClick={() => void changeStatus(entry.id, "contacted")}>{c.markContacted}</Button> : null}<Button size="sm" variant="secondary" disabled={busyId === entry.id} onClick={() => void changeStatus(entry.id, "converted")}>{c.markConverted}</Button><Button size="sm" variant="secondary" disabled={busyId === entry.id} onClick={() => void changeStatus(entry.id, "cancelled")}>{c.cancel}</Button><Button size="sm" variant="secondary" disabled={busyId === entry.id} onClick={() => void changeStatus(entry.id, "expired")}>{c.expire}</Button></div>
          </div>
        </article>)}</div>}
    </section>
  );
}
