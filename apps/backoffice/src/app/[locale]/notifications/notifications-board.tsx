"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Notification = { id: string; eventKey: string; entityType: string | null; entityId: string | null; severity: "info" | "success" | "warning" | "critical"; title: string; body: string | null; metadata: Record<string, unknown>; createdAt: string; readAt: string | null };
type NotificationsResponse = { data: { notifications: Notification[]; total: number; unread: number } };
type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": { title: "Centro de notificações", subtitle: "Novas reservas, lista de espera, eventos e pedidos takeaway aparecem aqui automaticamente.", all: "Todas", unread: "Não lidas", markAll: "Marcar tudo como lido", loading: "A carregar notificações…", empty: "Não existem notificações.", refresh: "Atualizar", read: "Marcar como lida", total: "Total", unreadCount: "Por ler", reservation: "Nova reserva recebida", waitlist: "Novo pedido na lista de espera", event: "Novo pedido de evento", order: "Novo pedido takeaway" },
  "pt-BR": { title: "Central de notificações", subtitle: "Novas reservas, lista de espera, eventos e pedidos takeaway aparecem aqui automaticamente.", all: "Todas", unread: "Não lidas", markAll: "Marcar tudo como lido", loading: "Carregando notificações…", empty: "Não há notificações.", refresh: "Atualizar", read: "Marcar como lida", total: "Total", unreadCount: "Não lidas", reservation: "Nova reserva recebida", waitlist: "Novo pedido na lista de espera", event: "Novo pedido de evento", order: "Novo pedido takeaway" },
  en: { title: "Notification center", subtitle: "New reservations, waitlist entries, events and takeaway orders appear here automatically.", all: "All", unread: "Unread", markAll: "Mark all as read", loading: "Loading notifications…", empty: "There are no notifications.", refresh: "Refresh", read: "Mark as read", total: "Total", unreadCount: "Unread", reservation: "New reservation received", waitlist: "New waitlist request", event: "New event enquiry", order: "New takeaway order" },
  es: { title: "Centro de notificaciones", subtitle: "Nuevas reservas, lista de espera, eventos y pedidos takeaway aparecen aquí automáticamente.", all: "Todas", unread: "No leídas", markAll: "Marcar todo como leído", loading: "Cargando notificaciones…", empty: "No hay notificaciones.", refresh: "Actualizar", read: "Marcar como leída", total: "Total", unreadCount: "Sin leer", reservation: "Nueva reserva recibida", waitlist: "Nueva solicitud en lista de espera", event: "Nueva solicitud de evento", order: "Nuevo pedido takeaway" },
} as const satisfies Record<Locale, Record<string, string>>;

function titleFor(eventKey: string, locale: Locale, fallback: string) {
  const c = copy[locale];
  if (eventKey === "reservation.public_created") return c.reservation;
  if (eventKey === "reservation.waitlist_public_joined") return c.waitlist;
  if (eventKey === "event_lead.public_created") return c.event;
  if (eventKey === "order.public_created") return c.order;
  return fallback;
}

async function readError(response: Response) { const body = (await response.json().catch(() => ({}))) as ErrorResponse; return body.message ?? `Request failed (${response.status})`; }

export function NotificationsBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/notifications/v1/notifications?limit=150${unreadOnly ? "&unread=true" : ""}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as NotificationsResponse;
      setItems(body.data.notifications); setTotal(body.data.total); setUnreadCount(body.data.unread);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unexpected error"); }
    finally { setLoading(false); }
  }, [unreadOnly]);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    setBusyId(id); setError(null);
    try {
      const response = await fetch(`/api/notifications/v1/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (readFailure) { setError(readFailure instanceof Error ? readFailure.message : "Unexpected error"); }
    finally { setBusyId(null); }
  }

  async function markAll() {
    setBusyId("all"); setError(null);
    try {
      const response = await fetch("/api/notifications/v1/notifications/read-all", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (readFailure) { setError(readFailure instanceof Error ? readFailure.message : "Unexpected error"); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-semibold">{c.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{c.refresh}</Button><Button variant="secondary" size="sm" onClick={() => void markAll()} disabled={busyId === "all" || unreadCount === 0}>{c.markAll}</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4"><div className="text-2xl font-semibold">{total}</div><div className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{c.total}</div></div><div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4"><div className="text-2xl font-semibold">{unreadCount}</div><div className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{c.unreadCount}</div></div></div>
    <div className="flex gap-2"><button type="button" onClick={() => setUnreadOnly(false)} className={`rounded-lg px-3 py-2 text-sm font-medium ${!unreadOnly ? "bg-[var(--mandys-foreground)] text-[var(--mandys-background)]" : "bg-[var(--mandys-surface-muted)]"}`}>{c.all}</button><button type="button" onClick={() => setUnreadOnly(true)} className={`rounded-lg px-3 py-2 text-sm font-medium ${unreadOnly ? "bg-[var(--mandys-foreground)] text-[var(--mandys-background)]" : "bg-[var(--mandys-surface-muted)]"}`}>{c.unread}</button></div>
    {error ? <div className="rounded-md bg-[var(--mandys-surface-muted)] p-3 text-sm text-[var(--mandys-foreground-muted)]">{error}</div> : null}
    {loading ? <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div> : items.length === 0 ? <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</div> : <div className="space-y-3">{items.map((item) => <article key={item.id} className={`rounded-[var(--mandys-radius-lg)] border p-4 sm:p-5 ${item.readAt ? "border-[var(--mandys-border)] bg-[var(--mandys-surface)]" : "border-[var(--mandys-accent)] bg-[var(--mandys-surface)]"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{titleFor(item.eventKey, locale, item.title)}</h3><span className="rounded-full bg-[var(--mandys-surface-muted)] px-2 py-1 text-[11px] font-medium">{item.severity}</span></div>{item.body ? <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{item.body}</p> : null}<p className="mt-2 text-xs text-[var(--mandys-foreground-muted)]">{dateFormatter.format(new Date(item.createdAt))}</p></div>{!item.readAt ? <Button variant="secondary" size="sm" disabled={busyId === item.id} onClick={() => void markRead(item.id)}>{c.read}</Button> : null}</div></article>)}</div>}
  </div>;
}
