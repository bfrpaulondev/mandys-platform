"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type SpecialHour = {
  id: string;
  serviceDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  label: string | null;
};

type SpecialHoursResponse = {
  data: {
    location: { id: string; name: string };
    specialHours: SpecialHour[];
  };
};

const copy = {
  "pt-PT": {
    title: "Horários especiais e feriados",
    help: "Defina exceções ao horário semanal para feriados, encerramentos e serviços especiais. Uma exceção aplica-se apenas à data escolhida.",
    location: "Localização",
    date: "Data",
    label: "Motivo / nome",
    labelPlaceholder: "Natal, evento privado…",
    closed: "Fechado todo o dia",
    opens: "Abre",
    closes: "Fecha",
    save: "Guardar exceção",
    saving: "A guardar…",
    update: "Atualizar exceção",
    edit: "Editar",
    remove: "Remover",
    cancelEdit: "Cancelar edição",
    empty: "Ainda não existem horários especiais.",
    saved: "Horário especial guardado.",
    removed: "Horário especial removido.",
    loading: "A carregar horários especiais…",
    genericError: "Não foi possível concluir a operação.",
    openStatus: "Aberto",
    closedStatus: "Fechado",
  },
  "pt-BR": {
    title: "Horários especiais e feriados",
    help: "Defina exceções ao horário semanal para feriados, fechamentos e serviços especiais. Uma exceção vale somente para a data escolhida.",
    location: "Unidade",
    date: "Data",
    label: "Motivo / nome",
    labelPlaceholder: "Natal, evento privado…",
    closed: "Fechado o dia todo",
    opens: "Abre",
    closes: "Fecha",
    save: "Salvar exceção",
    saving: "Salvando…",
    update: "Atualizar exceção",
    edit: "Editar",
    remove: "Remover",
    cancelEdit: "Cancelar edição",
    empty: "Ainda não existem horários especiais.",
    saved: "Horário especial salvo.",
    removed: "Horário especial removido.",
    loading: "Carregando horários especiais…",
    genericError: "Não foi possível concluir a operação.",
    openStatus: "Aberto",
    closedStatus: "Fechado",
  },
  en: {
    title: "Special hours and holidays",
    help: "Add date-specific exceptions to the weekly schedule for holidays, closures and special service. Each override applies only to its selected date.",
    location: "Location",
    date: "Date",
    label: "Reason / name",
    labelPlaceholder: "Christmas, private event…",
    closed: "Closed all day",
    opens: "Opens",
    closes: "Closes",
    save: "Save exception",
    saving: "Saving…",
    update: "Update exception",
    edit: "Edit",
    remove: "Remove",
    cancelEdit: "Cancel edit",
    empty: "There are no special hours yet.",
    saved: "Special hours saved.",
    removed: "Special hours removed.",
    loading: "Loading special hours…",
    genericError: "The operation could not be completed.",
    openStatus: "Open",
    closedStatus: "Closed",
  },
  es: {
    title: "Horarios especiales y festivos",
    help: "Define excepciones al horario semanal para festivos, cierres y servicios especiales. Cada excepción se aplica solo a la fecha elegida.",
    location: "Ubicación",
    date: "Fecha",
    label: "Motivo / nombre",
    labelPlaceholder: "Navidad, evento privado…",
    closed: "Cerrado todo el día",
    opens: "Abre",
    closes: "Cierra",
    save: "Guardar excepción",
    saving: "Guardando…",
    update: "Actualizar excepción",
    edit: "Editar",
    remove: "Eliminar",
    cancelEdit: "Cancelar edición",
    empty: "Todavía no existen horarios especiales.",
    saved: "Horario especial guardado.",
    removed: "Horario especial eliminado.",
    loading: "Cargando horarios especiales…",
    genericError: "No se pudo completar la operación.",
    openStatus: "Abierto",
    closedStatus: "Cerrado",
  },
} as const;

const fieldClassName =
  "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

function todayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export function SpecialHoursSettings({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [location, setLocation] = useState<{ id: string; name: string } | null>(null);
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>([]);
  const [serviceDate, setServiceDate] = useState(todayIso);
  const [label, setLabel] = useState("");
  const [isClosed, setIsClosed] = useState(true);
  const [opensAt, setOpensAt] = useState("12:00");
  const [closesAt, setClosesAt] = useState("23:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }),
    [locale],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/special-hours/v1/settings", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response, c.genericError));
      const body = (await response.json()) as SpecialHoursResponse;
      setLocation(body.data.location);
      setSpecialHours(body.data.specialHours);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : c.genericError);
    } finally {
      setLoading(false);
    }
  }, [c.genericError]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setServiceDate(todayIso());
    setLabel("");
    setIsClosed(true);
    setOpensAt("12:00");
    setClosesAt("23:00");
    setEditingId(null);
  }

  function edit(row: SpecialHour) {
    setServiceDate(row.serviceDate);
    setLabel(row.label ?? "");
    setIsClosed(row.isClosed);
    setOpensAt(row.opensAt ?? "12:00");
    setClosesAt(row.closesAt ?? "23:00");
    setEditingId(row.id);
    setError(null);
    setMessage(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/special-hours/v1/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceDate,
          label: label.trim() || null,
          isClosed,
          opensAt: isClosed ? null : opensAt,
          closesAt: isClosed ? null : closesAt,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, c.genericError));
      setMessage(c.saved);
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : c.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/special-hours/v1/settings/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readError(response, c.genericError));
      if (editingId === id) resetForm();
      setMessage(c.removed);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : c.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{c.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.help}</p>
        </div>
        {location ? <p className="text-xs text-[var(--mandys-foreground-muted)]">{c.location}: <strong className="text-[var(--mandys-foreground)]">{location.name}</strong></p> : null}
      </div>

      {error ? <p role="alert" className="mt-4 rounded-xl border border-[var(--mandys-danger)]/30 p-4 text-sm text-[var(--mandys-danger)]">{error}</p> : null}
      {message ? <p role="status" className="mt-4 rounded-xl border border-[var(--mandys-border)] bg-[var(--mandys-surface-muted)] p-4 text-sm">{message}</p> : null}

      <form onSubmit={save} className="mt-6 grid gap-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">
          {c.date}
          <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} required className={fieldClassName} />
        </label>
        <label className="text-sm font-medium md:col-span-1 xl:col-span-2">
          {c.label}
          <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} placeholder={c.labelPlaceholder} className={fieldClassName} />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" checked={isClosed} onChange={(event) => setIsClosed(event.target.checked)} />
          {c.closed}
        </label>
        <label className="text-sm font-medium">
          {c.opens}
          <input type="time" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} disabled={isClosed} required={!isClosed} className={fieldClassName} />
        </label>
        <label className="text-sm font-medium">
          {c.closes}
          <input type="time" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} disabled={isClosed} required={!isClosed} className={fieldClassName} />
        </label>
        <div className="flex items-end gap-2 md:col-span-2">
          <Button type="submit" disabled={busy}>{busy ? c.saving : editingId ? c.update : c.save}</Button>
          {editingId ? <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>{c.cancelEdit}</Button> : null}
        </div>
      </form>

      <div className="mt-6">
        {loading ? <p className="py-4 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</p> : specialHours.length === 0 ? (
          <div className="rounded-[var(--mandys-radius-md)] border border-dashed border-[var(--mandys-border)] p-6 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</div>
        ) : (
          <ul className="space-y-3">
            {specialHours.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{dateFormatter.format(new Date(`${row.serviceDate}T00:00:00.000Z`))}{row.label ? ` · ${row.label}` : ""}</p>
                  <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">
                    {row.isClosed ? c.closedStatus : `${c.openStatus} ${row.opensAt}–${row.closesAt}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => edit(row)}>{c.edit}</Button>
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void remove(row.id)}>{c.remove}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
