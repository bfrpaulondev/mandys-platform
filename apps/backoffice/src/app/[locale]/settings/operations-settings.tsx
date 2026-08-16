"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type OpeningHour = {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

type DiningArea = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type RestaurantTable = {
  id: string;
  diningAreaId: string;
  name: string;
  minSeats: number;
  maxSeats: number;
  isActive: boolean;
};

type OperationsResponse = {
  data: {
    location: { id: string; name: string };
    openingHours: OpeningHour[];
    diningAreas: DiningArea[];
    tables: RestaurantTable[];
  };
};

const copy = {
  "pt-PT": {
    location: "Localização",
    hours: "Horário de funcionamento",
    hoursHelp: "Defina quando o restaurante recebe clientes. Estes horários também aparecem no site público.",
    open: "Aberto",
    closed: "Fechado",
    from: "Abre",
    to: "Fecha",
    saveHours: "Guardar horários",
    saving: "A guardar…",
    areas: "Salas e zonas",
    areasHelp: "Crie as áreas físicas usadas para organizar mesas e reservas.",
    newArea: "Nova sala / zona",
    areaName: "Nome da sala",
    createArea: "Criar sala",
    tables: "Mesas",
    newTable: "Nova mesa",
    area: "Sala / zona",
    tableName: "Nome da mesa",
    minSeats: "Mín. lugares",
    maxSeats: "Máx. lugares",
    createTable: "Criar mesa",
    noAreas: "Ainda não existem salas. Crie a primeira para adicionar mesas.",
    noTables: "Ainda não existem mesas nesta sala.",
    loading: "A carregar configuração…",
    retry: "Atualizar",
    saved: "Configuração guardada.",
    genericError: "Não foi possível concluir a operação.",
  },
  "pt-BR": {
    location: "Unidade",
    hours: "Horário de funcionamento",
    hoursHelp: "Defina quando o restaurante recebe clientes. Estes horários também aparecem no site público.",
    open: "Aberto",
    closed: "Fechado",
    from: "Abre",
    to: "Fecha",
    saveHours: "Salvar horários",
    saving: "Salvando…",
    areas: "Salões e áreas",
    areasHelp: "Crie as áreas físicas usadas para organizar mesas e reservas.",
    newArea: "Novo salão / área",
    areaName: "Nome do salão",
    createArea: "Criar salão",
    tables: "Mesas",
    newTable: "Nova mesa",
    area: "Salão / área",
    tableName: "Nome da mesa",
    minSeats: "Mín. lugares",
    maxSeats: "Máx. lugares",
    createTable: "Criar mesa",
    noAreas: "Ainda não existem salões. Crie o primeiro para adicionar mesas.",
    noTables: "Ainda não existem mesas neste salão.",
    loading: "Carregando configuração…",
    retry: "Atualizar",
    saved: "Configuração salva.",
    genericError: "Não foi possível concluir a operação.",
  },
  en: {
    location: "Location",
    hours: "Opening hours",
    hoursHelp: "Set when the restaurant receives guests. These hours are also shown on the public site.",
    open: "Open",
    closed: "Closed",
    from: "Opens",
    to: "Closes",
    saveHours: "Save hours",
    saving: "Saving…",
    areas: "Dining areas",
    areasHelp: "Create the physical areas used to organize tables and bookings.",
    newArea: "New dining area",
    areaName: "Area name",
    createArea: "Create area",
    tables: "Tables",
    newTable: "New table",
    area: "Dining area",
    tableName: "Table name",
    minSeats: "Min. seats",
    maxSeats: "Max. seats",
    createTable: "Create table",
    noAreas: "There are no dining areas yet. Create one before adding tables.",
    noTables: "There are no tables in this area yet.",
    loading: "Loading configuration…",
    retry: "Refresh",
    saved: "Configuration saved.",
    genericError: "The operation could not be completed.",
  },
  es: {
    location: "Ubicación",
    hours: "Horario de apertura",
    hoursHelp: "Define cuándo recibe clientes el restaurante. Estos horarios también aparecen en la web pública.",
    open: "Abierto",
    closed: "Cerrado",
    from: "Abre",
    to: "Cierra",
    saveHours: "Guardar horarios",
    saving: "Guardando…",
    areas: "Zonas y salones",
    areasHelp: "Crea las zonas físicas que se utilizan para organizar mesas y reservas.",
    newArea: "Nueva zona / salón",
    areaName: "Nombre de la zona",
    createArea: "Crear zona",
    tables: "Mesas",
    newTable: "Nueva mesa",
    area: "Zona / salón",
    tableName: "Nombre de la mesa",
    minSeats: "Mín. plazas",
    maxSeats: "Máx. plazas",
    createTable: "Crear mesa",
    noAreas: "Todavía no existen zonas. Crea la primera antes de añadir mesas.",
    noTables: "Todavía no existen mesas en esta zona.",
    loading: "Cargando configuración…",
    retry: "Actualizar",
    saved: "Configuración guardada.",
    genericError: "No se pudo completar la operación.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const weekdayLabels: Record<Locale, string[]> = {
  "pt-PT": ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  "pt-BR": ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
};

const fieldClassName =
  "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

function defaultHours(): OpeningHour[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: "12:00",
    closesAt: "23:00",
    isClosed: false,
  }));
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export function OperationsSettings({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const days = weekdayLabels[locale];
  const [location, setLocation] = useState<{ id: string; name: string } | null>(null);
  const [hours, setHours] = useState<OpeningHour[]>(defaultHours);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/operations/v1/settings/operations", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response, c.genericError));
      const body = (await response.json()) as OperationsResponse;
      setLocation(body.data.location);
      const byWeekday = new Map(body.data.openingHours.map((row) => [row.weekday, row]));
      setHours(defaultHours().map((fallback) => byWeekday.get(fallback.weekday) ?? fallback));
      setAreas(body.data.diningAreas);
      setTables(body.data.tables);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : c.genericError);
    } finally {
      setLoading(false);
    }
  }, [c.genericError]);

  useEffect(() => {
    void load();
  }, [load]);

  const tablesByArea = useMemo(() => {
    const map = new Map<string, RestaurantTable[]>();
    for (const area of areas) map.set(area.id, []);
    for (const table of tables) map.set(table.diningAreaId, [...(map.get(table.diningAreaId) ?? []), table]);
    return map;
  }, [areas, tables]);

  function updateHour(weekday: number, patch: Partial<OpeningHour>) {
    setHours((current) => current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  }

  async function saveHours() {
    if (!location) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/operations/v1/settings/opening-hours", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId: location.id, hours }),
      });
      if (!response.ok) throw new Error(await readError(response, c.genericError));
      setMessage(c.saved);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : c.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function createArea(formData: FormData) {
    if (!location) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/operations/v1/settings/dining-areas", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          name: String(formData.get("name") ?? ""),
          sortOrder: areas.length,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, c.genericError));
      setMessage(c.saved);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : c.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function createTable(formData: FormData) {
    if (!location) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/operations/v1/settings/tables", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          diningAreaId: String(formData.get("diningAreaId") ?? ""),
          name: String(formData.get("name") ?? ""),
          minSeats: Number(formData.get("minSeats") ?? 1),
          maxSeats: Number(formData.get("maxSeats") ?? 2),
        }),
      });
      if (!response.ok) throw new Error(await readError(response, c.genericError));
      setMessage(c.saved);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : c.genericError);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !location) {
    return <p className="py-12 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</p>;
  }

  if (!location) {
    return (
      <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] p-6">
        <p className="text-sm text-[var(--mandys-danger)]">{error ?? c.genericError}</p>
        <Button className="mt-4" variant="secondary" onClick={() => void load()}>{c.retry}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--mandys-foreground-muted)]">{c.location}</p>
          <p className="mt-1 font-semibold">{location.name}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading || busy}>{c.retry}</Button>
      </div>

      {error ? <p role="alert" className="rounded-xl border border-[var(--mandys-danger)]/30 p-4 text-sm text-[var(--mandys-danger)]">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl border border-[var(--mandys-border)] bg-[var(--mandys-surface-muted)] p-4 text-sm">{message}</p> : null}

      <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{c.hours}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.hoursHelp}</p>
        <div className="mt-6 space-y-3">
          {hours.map((row) => (
            <div key={row.weekday} className="grid gap-3 rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] p-3 sm:grid-cols-[150px_120px_1fr_1fr] sm:items-end">
              <div className="font-medium">{days[row.weekday]}</div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={row.isClosed} onChange={(event) => updateHour(row.weekday, { isClosed: event.target.checked })} />
                {row.isClosed ? c.closed : c.open}
              </label>
              <label className="text-sm font-medium">
                {c.from}
                <input type="time" value={row.opensAt ?? "12:00"} disabled={row.isClosed} onChange={(event) => updateHour(row.weekday, { opensAt: event.target.value })} className={fieldClassName} />
              </label>
              <label className="text-sm font-medium">
                {c.to}
                <input type="time" value={row.closesAt ?? "23:00"} disabled={row.isClosed} onChange={(event) => updateHour(row.weekday, { closesAt: event.target.value })} className={fieldClassName} />
              </label>
            </div>
          ))}
        </div>
        <Button className="mt-5" disabled={busy} onClick={() => void saveHours()}>{busy ? c.saving : c.saveHours}</Button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="h-fit rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
          <h2 className="text-xl font-semibold">{c.areas}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.areasHelp}</p>
          <form action={createArea} className="mt-6 space-y-4">
            <h3 className="text-sm font-semibold">{c.newArea}</h3>
            <label className="block text-sm font-medium">
              {c.areaName}
              <input name="name" required minLength={1} maxLength={100} placeholder="Interior" className={fieldClassName} />
            </label>
            <Button type="submit" disabled={busy}>{c.createArea}</Button>
          </form>

          <form action={createTable} className="mt-8 space-y-4 border-t border-[var(--mandys-border)] pt-6">
            <h3 className="text-sm font-semibold">{c.newTable}</h3>
            <label className="block text-sm font-medium">
              {c.area}
              <select name="diningAreaId" required disabled={areas.length === 0} className={fieldClassName}>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">
              {c.tableName}
              <input name="name" required minLength={1} maxLength={80} placeholder="Mesa 1" className={fieldClassName} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                {c.minSeats}
                <input name="minSeats" type="number" min={1} max={100} defaultValue={1} required className={fieldClassName} />
              </label>
              <label className="block text-sm font-medium">
                {c.maxSeats}
                <input name="maxSeats" type="number" min={1} max={100} defaultValue={4} required className={fieldClassName} />
              </label>
            </div>
            <Button type="submit" disabled={busy || areas.length === 0}>{c.createTable}</Button>
            {areas.length === 0 ? <p className="text-xs text-[var(--mandys-foreground-muted)]">{c.noAreas}</p> : null}
          </form>
        </aside>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{c.tables}</h2>
          </div>
          {areas.length === 0 ? (
            <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.noAreas}</div>
          ) : areas.map((area) => {
            const areaTables = tablesByArea.get(area.id) ?? [];
            const seats = areaTables.reduce((total, table) => total + table.maxSeats, 0);
            return (
              <article key={area.id} className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold">{area.name}</h3>
                  <span className="text-xs text-[var(--mandys-foreground-muted)]">{areaTables.length} {c.tables.toLowerCase()} · {seats} {c.maxSeats.toLowerCase()}</span>
                </div>
                {areaTables.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--mandys-foreground-muted)]">{c.noTables}</p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {areaTables.map((table) => (
                      <div key={table.id} className="rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] p-4">
                        <p className="font-medium">{table.name}</p>
                        <p className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{table.minSeats}–{table.maxSeats} {c.maxSeats.toLowerCase()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
