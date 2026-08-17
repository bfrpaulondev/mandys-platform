"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Activity = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  source: "team" | "public" | "system";
};

type ActivityResponse = {
  data: {
    data: Activity[];
    page: { hasMore: boolean; nextCursor: string | null };
    summary: { last_24h: number; today: number; team_7d: number; public_7d: number };
    facets: Array<{ action: string; entityType: string; total: number }>;
  };
};

type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": {
    subtitle: "Histórico imutável das alterações relevantes no restaurante. Útil para segurança, suporte e saber quem fez o quê.",
    today: "Hoje", last24: "Últimas 24h", team7d: "Ações da equipa · 7d", public7d: "Ações públicas · 7d",
    source: "Origem", allSources: "Todas", team: "Equipa", public: "Website", system: "Sistema", action: "Ação", allActions: "Todas as ações", entity: "Área", allEntities: "Todas as áreas",
    loading: "A carregar atividade…", empty: "Ainda não existem registos com estes filtros.", refresh: "Atualizar", more: "Carregar mais", metadata: "Detalhes técnicos", actor: "por", publicActor: "Visitante do website", systemActor: "Sistema Mandy's",
  },
  "pt-BR": {
    subtitle: "Histórico imutável das alterações relevantes no restaurante. Útil para segurança, suporte e saber quem fez o quê.",
    today: "Hoje", last24: "Últimas 24h", team7d: "Ações da equipe · 7d", public7d: "Ações públicas · 7d",
    source: "Origem", allSources: "Todas", team: "Equipe", public: "Website", system: "Sistema", action: "Ação", allActions: "Todas as ações", entity: "Área", allEntities: "Todas as áreas",
    loading: "Carregando atividade…", empty: "Ainda não existem registros com estes filtros.", refresh: "Atualizar", more: "Carregar mais", metadata: "Detalhes técnicos", actor: "por", publicActor: "Visitante do website", systemActor: "Sistema Mandy's",
  },
  en: {
    subtitle: "An immutable history of meaningful restaurant changes. Useful for security, support and knowing who changed what.",
    today: "Today", last24: "Last 24h", team7d: "Team actions · 7d", public7d: "Public actions · 7d",
    source: "Source", allSources: "All", team: "Team", public: "Website", system: "System", action: "Action", allActions: "All actions", entity: "Area", allEntities: "All areas",
    loading: "Loading activity…", empty: "There are no records matching these filters yet.", refresh: "Refresh", more: "Load more", metadata: "Technical details", actor: "by", publicActor: "Website visitor", systemActor: "Mandy's system",
  },
  es: {
    subtitle: "Historial inmutable de los cambios relevantes del restaurante. Útil para seguridad, soporte y saber quién hizo qué.",
    today: "Hoy", last24: "Últimas 24h", team7d: "Acciones del equipo · 7d", public7d: "Acciones públicas · 7d",
    source: "Origen", allSources: "Todas", team: "Equipo", public: "Web", system: "Sistema", action: "Acción", allActions: "Todas las acciones", entity: "Área", allEntities: "Todas las áreas",
    loading: "Cargando actividad…", empty: "Todavía no hay registros con estos filtros.", refresh: "Actualizar", more: "Cargar más", metadata: "Detalles técnicos", actor: "por", publicActor: "Visitante de la web", systemActor: "Sistema Mandy's",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const actionLabels: Record<string, Record<Locale, string>> = {
  "restaurant.created": { "pt-PT": "Restaurante criado", "pt-BR": "Restaurante criado", en: "Restaurant created", es: "Restaurante creado" },
  "restaurant.profile_updated": { "pt-PT": "Perfil atualizado", "pt-BR": "Perfil atualizado", en: "Profile updated", es: "Perfil actualizado" },
  "opening_hours.updated": { "pt-PT": "Horário atualizado", "pt-BR": "Horário atualizado", en: "Opening hours updated", es: "Horario actualizado" },
  "dining_area.created": { "pt-PT": "Zona criada", "pt-BR": "Área criada", en: "Dining area created", es: "Zona creada" },
  "restaurant_table.created": { "pt-PT": "Mesa criada", "pt-BR": "Mesa criada", en: "Table created", es: "Mesa creada" },
  "menu.created": { "pt-PT": "Menu criado", "pt-BR": "Cardápio criado", en: "Menu created", es: "Menú creado" },
  "menu.updated": { "pt-PT": "Menu atualizado", "pt-BR": "Cardápio atualizado", en: "Menu updated", es: "Menú actualizado" },
  "menu.category_created": { "pt-PT": "Categoria criada", "pt-BR": "Categoria criada", en: "Category created", es: "Categoría creada" },
  "menu.item_created": { "pt-PT": "Item criado", "pt-BR": "Item criado", en: "Item created", es: "Item creado" },
  "reservation.created": { "pt-PT": "Reserva criada pela equipa", "pt-BR": "Reserva criada pela equipe", en: "Reservation created by team", es: "Reserva creada por el equipo" },
  "reservation.public_created": { "pt-PT": "Reserva recebida pelo website", "pt-BR": "Reserva recebida pelo website", en: "Reservation received from website", es: "Reserva recibida desde la web" },
  "reservation.status_changed": { "pt-PT": "Estado da reserva alterado", "pt-BR": "Status da reserva alterado", en: "Reservation status changed", es: "Estado de reserva modificado" },
  "reservation.status_updated": { "pt-PT": "Estado da reserva atualizado", "pt-BR": "Status da reserva atualizado", en: "Reservation status updated", es: "Estado de reserva actualizado" },
  "event_lead.created": { "pt-PT": "Pedido de evento criado", "pt-BR": "Pedido de evento criado", en: "Event enquiry created", es: "Solicitud de evento creada" },
  "event_lead.public_created": { "pt-PT": "Pedido de evento recebido pelo website", "pt-BR": "Pedido de evento recebido pelo website", en: "Event enquiry received from website", es: "Solicitud de evento recibida desde la web" },
  "event_lead.status_changed": { "pt-PT": "Estado do evento alterado", "pt-BR": "Status do evento alterado", en: "Event status changed", es: "Estado del evento modificado" },
  "customer.created": { "pt-PT": "Cliente criado", "pt-BR": "Cliente criado", en: "Customer created", es: "Cliente creado" },
  "customer.updated": { "pt-PT": "Cliente atualizado", "pt-BR": "Cliente atualizado", en: "Customer updated", es: "Cliente actualizado" },
};

function readableAction(action: string, locale: Locale): string {
  return actionLabels[action]?.[locale] ?? action.split(/[._]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function readableEntity(entity: string): string {
  return entity.split("_").filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  return body.message ?? `Request failed (${response.status})`;
}

export function ActivityBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [items, setItems] = useState<Activity[]>([]);
  const [summary, setSummary] = useState({ last_24h: 0, today: 0, team_7d: 0, public_7d: 0 });
  const [facets, setFacets] = useState<Array<{ action: string; entityType: string; total: number }>>([]);
  const [source, setSource] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }), [locale]);

  const actions = useMemo(() => [...new Set(facets.map(row => row.action))].sort(), [facets]);
  const entities = useMemo(() => [...new Set(facets.map(row => row.entityType))].sort(), [facets]);

  const fetchPage = useCallback(async (cursor: string | null, append: boolean) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (source) params.set("source", source);
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (cursor) params.set("before", cursor);
      const response = await fetch(`/api/activity/v1/activity?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const responseBody = (await response.json()) as ActivityResponse;
      const body = responseBody.data;
      setItems(current => append ? [...current, ...body.data] : body.data);
      setSummary(body.summary);
      setFacets(body.facets);
      setNextCursor(body.page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error");
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [action, entityType, source]);

  useEffect(() => { void fetchPage(null, false); }, [fetchPage]);

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: c.today, value: summary.today }, { label: c.last24, value: summary.last_24h }, { label: c.team7d, value: summary.team_7d }, { label: c.public7d, value: summary.public_7d }].map(card => (
          <div key={card.label} className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4">
            <div className="text-2xl font-semibold">{card.value}</div><div className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{card.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_1fr_auto] lg:items-end">
          <label className="text-sm font-medium">{c.source}<select value={source} onChange={event => setSource(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3"><option value="">{c.allSources}</option><option value="team">{c.team}</option><option value="public">{c.public}</option><option value="system">{c.system}</option></select></label>
          <label className="text-sm font-medium">{c.action}<select value={action} onChange={event => setAction(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3"><option value="">{c.allActions}</option>{actions.map(value => <option key={value} value={value}>{readableAction(value, locale)}</option>)}</select></label>
          <label className="text-sm font-medium">{c.entity}<select value={entityType} onChange={event => setEntityType(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3"><option value="">{c.allEntities}</option>{entities.map(value => <option key={value} value={value}>{readableEntity(value)}</option>)}</select></label>
          <Button variant="secondary" size="sm" onClick={() => void fetchPage(null, false)} disabled={loading}>{c.refresh}</Button>
        </div>
      </section>

      {error ? <div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 text-sm text-[var(--mandys-foreground-muted)]">{error}</div> : null}
      {loading ? <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div>
      : items.length === 0 ? <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</div>
      : <section className="overflow-hidden rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)]">
          <div className="divide-y divide-[var(--mandys-border)]">
            {items.map(item => {
              const actor = item.actorName ?? item.actorEmail ?? (item.source === "public" ? c.publicActor : c.systemActor);
              return <article key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{readableAction(item.action, locale)}</h3><span className="rounded-full bg-[var(--mandys-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--mandys-foreground-muted)]">{item.source === "team" ? c.team : item.source === "public" ? c.public : c.system}</span></div><p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{readableEntity(item.entityType)}{item.entityId ? ` · ${item.entityId.slice(0, 12)}` : ""} · {c.actor} {actor}</p></div>
                  <time className="shrink-0 text-xs text-[var(--mandys-foreground-muted)]" dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time>
                </div>
                {Object.keys(item.metadata).length > 0 ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-[var(--mandys-foreground-muted)]">{c.metadata}</summary><pre className="mt-2 max-h-72 overflow-auto rounded-md bg-[var(--mandys-surface-muted)] p-3 text-[11px] leading-5">{JSON.stringify(item.metadata, null, 2)}</pre></details> : null}
              </article>;
            })}
          </div>
          {nextCursor ? <div className="border-t border-[var(--mandys-border)] p-4 text-center"><Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void fetchPage(nextCursor, true)}>{c.more}</Button></div> : null}
        </section>}
    </div>
  );
}
