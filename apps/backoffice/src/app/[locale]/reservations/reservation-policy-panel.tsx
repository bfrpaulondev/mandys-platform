"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useState } from "react";

type ExceptionRow = { id: string; date: string; isClosed: boolean; opensAt: string | null; closesAt: string | null; note: string | null };
type Policy = { locationId: string; locationName: string; timezone: string; durationMinutes: number; intervalMinutes: number; minimumNoticeMinutes: number; maximumAdvanceDays: number; maximumPartySize: number; waitlistEnabled: boolean; exceptions: ExceptionRow[] };
type PolicyResponse = { data: Policy };
type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": { title: "Política de reservas", help: "Controle antecedência, duração, intervalo, tamanho dos grupos e dias especiais sem alterar o horário semanal.", duration: "Duração média (min)", interval: "Intervalo dos horários", notice: "Antecedência mínima (min)", advance: "Máximo de dias antecipados", maxParty: "Máximo de pessoas online", waitlist: "Ativar lista de espera", save: "Guardar política", saving: "A guardar…", special: "Dias especiais", date: "Data", closed: "Encerrado todo o dia", open: "Abertura", close: "Fecho", note: "Nota", add: "Guardar dia especial", delete: "Remover", noSpecial: "Sem exceções futuras.", loading: "A carregar política…" },
  "pt-BR": { title: "Política de reservas", help: "Controle antecedência, duração, intervalo, tamanho dos grupos e dias especiais sem alterar o horário semanal.", duration: "Duração média (min)", interval: "Intervalo dos horários", notice: "Antecedência mínima (min)", advance: "Máximo de dias antecipados", maxParty: "Máximo de pessoas online", waitlist: "Ativar lista de espera", save: "Salvar política", saving: "Salvando…", special: "Dias especiais", date: "Data", closed: "Fechado o dia inteiro", open: "Abertura", close: "Fechamento", note: "Nota", add: "Salvar dia especial", delete: "Remover", noSpecial: "Sem exceções futuras.", loading: "Carregando política…" },
  en: { title: "Reservation policy", help: "Control notice, duration, slot interval, party size and special days without changing the weekly opening hours.", duration: "Average duration (min)", interval: "Slot interval", notice: "Minimum notice (min)", advance: "Maximum days ahead", maxParty: "Maximum online party size", waitlist: "Enable waitlist", save: "Save policy", saving: "Saving…", special: "Special days", date: "Date", closed: "Closed all day", open: "Opens", close: "Closes", note: "Note", add: "Save special day", delete: "Remove", noSpecial: "No upcoming exceptions.", loading: "Loading policy…" },
  es: { title: "Política de reservas", help: "Controla antelación, duración, intervalo, tamaño de grupos y días especiales sin cambiar el horario semanal.", duration: "Duración media (min)", interval: "Intervalo de horarios", notice: "Antelación mínima (min)", advance: "Máximo de días anticipados", maxParty: "Máximo de personas online", waitlist: "Activar lista de espera", save: "Guardar política", saving: "Guardando…", special: "Días especiales", date: "Fecha", closed: "Cerrado todo el día", open: "Apertura", close: "Cierre", note: "Nota", add: "Guardar día especial", delete: "Eliminar", noSpecial: "Sin excepciones futuras.", loading: "Cargando política…" },
} as const satisfies Record<Locale, Record<string, string>>;

const fieldClassName = "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";
async function readError(response: Response) { const body = (await response.json().catch(() => ({}))) as ErrorResponse; return body.message ?? `Request failed (${response.status})`; }

export function ReservationPolicyPanel({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/reservations/v1/policies", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as PolicyResponse;
      setPolicy(body.data);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unexpected error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function savePolicy(formData: FormData) {
    if (!policy) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/reservations/v1/policies", {
        method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          durationMinutes: Number(formData.get("durationMinutes")), intervalMinutes: Number(formData.get("intervalMinutes")),
          minimumNoticeMinutes: Number(formData.get("minimumNoticeMinutes")), maximumAdvanceDays: Number(formData.get("maximumAdvanceDays")),
          maximumPartySize: Number(formData.get("maximumPartySize")), waitlistEnabled: formData.get("waitlistEnabled") === "on",
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setNotice(c.save); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unexpected error"); }
    finally { setSaving(false); }
  }

  async function saveException(formData: FormData) {
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/reservations/v1/exceptions", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: String(formData.get("date") ?? ""), isClosed: closed, ...(closed ? {} : { opensAt: String(formData.get("opensAt") ?? ""), closesAt: String(formData.get("closesAt") ?? "") }), ...(formData.get("note") ? { note: String(formData.get("note")) } : {}) }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unexpected error"); }
    finally { setSaving(false); }
  }

  async function removeException(id: string) {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/reservations/v1/exceptions/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Unexpected error"); }
    finally { setSaving(false); }
  }

  if (loading && !policy) return <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</section>;

  return (
    <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
      <div><h2 className="text-xl font-semibold">{c.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.help}</p></div>
      {error ? <p className="mt-4 rounded-md bg-[var(--mandys-surface-muted)] p-3 text-sm text-[var(--mandys-foreground-muted)]">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm">{notice}</p> : null}
      {policy ? <form action={savePolicy} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium">{c.duration}<input name="durationMinutes" type="number" min={30} max={360} step={15} defaultValue={policy.durationMinutes} className={fieldClassName} /></label>
        <label className="text-sm font-medium">{c.interval}<select name="intervalMinutes" defaultValue={policy.intervalMinutes} className={fieldClassName}><option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option></select></label>
        <label className="text-sm font-medium">{c.notice}<input name="minimumNoticeMinutes" type="number" min={0} max={10080} step={15} defaultValue={policy.minimumNoticeMinutes} className={fieldClassName} /></label>
        <label className="text-sm font-medium">{c.advance}<input name="maximumAdvanceDays" type="number" min={1} max={365} defaultValue={policy.maximumAdvanceDays} className={fieldClassName} /></label>
        <label className="text-sm font-medium">{c.maxParty}<input name="maximumPartySize" type="number" min={1} max={100} defaultValue={policy.maximumPartySize} className={fieldClassName} /></label>
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2 lg:col-span-4"><input name="waitlistEnabled" type="checkbox" defaultChecked={policy.waitlistEnabled} />{c.waitlist}</label>
        <div><Button type="submit" disabled={saving}>{saving ? c.saving : c.save}</Button></div>
      </form> : null}

      <div className="mt-8 border-t border-[var(--mandys-border)] pt-6"><h3 className="font-semibold">{c.special}</h3>
        <form action={saveException} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_auto_130px_130px_1fr_auto] lg:items-end">
          <label className="text-sm font-medium">{c.date}<input name="date" type="date" required className={fieldClassName} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={closed} onChange={(event) => setClosed(event.target.checked)} />{c.closed}</label>
          <label className="text-sm font-medium">{c.open}<input name="opensAt" type="time" disabled={closed} required={!closed} className={fieldClassName} /></label>
          <label className="text-sm font-medium">{c.close}<input name="closesAt" type="time" disabled={closed} required={!closed} className={fieldClassName} /></label>
          <label className="text-sm font-medium">{c.note}<input name="note" maxLength={500} className={fieldClassName} /></label>
          <Button type="submit" variant="secondary" size="sm" disabled={saving}>{c.add}</Button>
        </form>
        <div className="mt-5 space-y-2">{policy?.exceptions.length ? policy.exceptions.map((row) => <div key={row.id} className="flex flex-col gap-2 rounded-md border border-[var(--mandys-border)] p-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm"><span className="font-medium">{row.date}</span><span className="ml-2 text-[var(--mandys-foreground-muted)]">{row.isClosed ? c.closed : `${row.opensAt}–${row.closesAt}`}{row.note ? ` · ${row.note}` : ""}</span></div><Button variant="secondary" size="sm" disabled={saving} onClick={() => void removeException(row.id)}>{c.delete}</Button></div>) : <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.noSpecial}</p>}</div>
      </div>
    </section>
  );
}
