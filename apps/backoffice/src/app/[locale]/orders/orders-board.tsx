"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
type OrderItem = { id: string; menuItemId: string | null; itemName: string; unitPriceCents: number; quantity: number; lineTotalCents: number; notes: string | null };
type Order = { id: string; orderNumber: number; status: OrderStatus; fulfillmentType: string; paymentMethod: string; currency: string; subtotalCents: number; totalCents: number; scheduledFor: string | null; guestName: string; guestEmail: string | null; guestPhone: string | null; notes: string | null; source: string; createdAt: string; updatedAt: string; items: OrderItem[] };
type OrdersResponse = { data: Order[] };
type ErrorResponse = { message?: string };

const transitions: Record<OrderStatus, Array<{ status: OrderStatus; key: "accept" | "prepare" | "ready" | "complete" | "cancel" }>> = {
  pending: [{ status: "accepted", key: "accept" }, { status: "cancelled", key: "cancel" }],
  accepted: [{ status: "preparing", key: "prepare" }, { status: "cancelled", key: "cancel" }],
  preparing: [{ status: "ready", key: "ready" }, { status: "cancelled", key: "cancel" }],
  ready: [{ status: "completed", key: "complete" }, { status: "cancelled", key: "cancel" }],
  completed: [], cancelled: [],
};

const copy = {
  "pt-PT": { subtitle: "Takeaway com pagamento no levantamento. Os pedidos entram diretamente aqui e avançam pela cozinha até à entrega.", refresh: "Atualizar", loading: "A carregar pedidos…", empty: "Ainda não existem pedidos.", pending: "Novo", accepted: "Aceite", preparing: "Em preparação", ready: "Pronto", completed: "Entregue", cancelled: "Cancelado", accept: "Aceitar", prepare: "Preparar", complete: "Entregue", cancel: "Cancelar", pickup: "Levantamento", pay: "Pagamento no levantamento", items: "itens", today: "Pedidos hoje", open: "Em aberto", readyCount: "Prontos", revenue: "Valor concluído", customer: "Cliente", order: "Pedido", source: "Origem" },
  "pt-BR": { subtitle: "Takeaway com pagamento na retirada. Os pedidos entram diretamente aqui e avançam pela cozinha até a entrega.", refresh: "Atualizar", loading: "Carregando pedidos…", empty: "Ainda não existem pedidos.", pending: "Novo", accepted: "Aceito", preparing: "Em preparação", ready: "Pronto", completed: "Entregue", cancelled: "Cancelado", accept: "Aceitar", prepare: "Preparar", complete: "Entregue", cancel: "Cancelar", pickup: "Retirada", pay: "Pagamento na retirada", items: "itens", today: "Pedidos hoje", open: "Em aberto", readyCount: "Prontos", revenue: "Valor concluído", customer: "Cliente", order: "Pedido", source: "Origem" },
  en: { subtitle: "Takeaway with payment at pickup. Orders arrive here and move through the kitchen until handoff.", refresh: "Refresh", loading: "Loading orders…", empty: "There are no orders yet.", pending: "New", accepted: "Accepted", preparing: "Preparing", ready: "Ready", completed: "Completed", cancelled: "Cancelled", accept: "Accept", prepare: "Start preparing", complete: "Handed over", cancel: "Cancel", pickup: "Pickup", pay: "Pay at pickup", items: "items", today: "Orders today", open: "Open", readyCount: "Ready", revenue: "Completed value", customer: "Customer", order: "Order", source: "Source" },
  es: { subtitle: "Takeaway con pago al recoger. Los pedidos llegan directamente aquí y avanzan por cocina hasta la entrega.", refresh: "Actualizar", loading: "Cargando pedidos…", empty: "Todavía no hay pedidos.", pending: "Nuevo", accepted: "Aceptado", preparing: "En preparación", ready: "Listo", completed: "Entregado", cancelled: "Cancelado", accept: "Aceptar", prepare: "Preparar", complete: "Entregado", cancel: "Cancelar", pickup: "Recogida", pay: "Pago al recoger", items: "artículos", today: "Pedidos hoy", open: "Abiertos", readyCount: "Listos", revenue: "Valor completado", customer: "Cliente", order: "Pedido", source: "Origen" },
} as const satisfies Record<Locale, Record<string, string>>;

async function readError(response: Response) { const body = (await response.json().catch(() => ({}))) as ErrorResponse; return body.message ?? `Request failed (${response.status})`; }

export function OrdersBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }), [locale]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/orders/v1/orders?limit=200", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as OrdersResponse;
      setOrders(body.data);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unexpected error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(orderId: string, status: OrderStatus) {
    const previous = orders.find((order) => order.id === orderId);
    if (!previous || busyId === orderId) return;

    setBusyId(orderId);
    setError(null);
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order));

    try {
      const response = await fetch(`/api/orders/v1/orders/${orderId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await readError(response));
    } catch (statusError) {
      setOrders((current) => current.map((order) => order.id === orderId ? previous : order));
      setError(statusError instanceof Error ? statusError.message : "Unexpected error");
    } finally {
      setBusyId(null);
    }
  }

  const todayKey = new Date().toDateString();
  const today = orders.filter((order) => new Date(order.createdAt).toDateString() === todayKey).length;
  const open = orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length;
  const ready = orders.filter((order) => order.status === "ready").length;
  const completedValue = orders.filter((order) => order.status === "completed").reduce((sum, order) => sum + order.totalCents, 0);
  const currency = orders[0]?.currency ?? "EUR";
  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [currency, locale]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{c.refresh}</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: c.today, value: String(today) }, { label: c.open, value: String(open) }, { label: c.readyCount, value: String(ready) }, { label: c.revenue, value: money.format(completedValue / 100) }].map((card) => <div key={card.label} className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4"><div className="text-2xl font-semibold">{card.value}</div><div className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{card.label}</div></div>)}</div>
      {error ? <div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 text-sm text-[var(--mandys-foreground-muted)]">{error}</div> : null}
      {loading ? <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div>
      : orders.length === 0 ? <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</div>
      : <div className="grid gap-4 xl:grid-cols-2">{orders.map((order) => <article key={order.id} aria-busy={busyId === order.id} className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{c.order} #{order.orderNumber}</h2><span className="rounded-full bg-[var(--mandys-surface-muted)] px-2.5 py-1 text-xs font-medium">{c[order.status]}</span></div><p className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{dateFormatter.format(new Date(order.createdAt))} · {c.pickup} · {c.pay}</p></div><div className="text-right"><div className="font-semibold">{money.format(order.totalCents / 100)}</div><div className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{order.items.reduce((sum, item) => sum + item.quantity, 0)} {c.items}</div></div></div>
          <div className="mt-4 border-t border-[var(--mandys-border)] pt-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--mandys-foreground-muted)]">{c.customer}</p><p className="mt-1 text-sm font-medium">{order.guestName}</p>{order.guestEmail || order.guestPhone ? <p className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{[order.guestEmail, order.guestPhone].filter(Boolean).join(" · ")}</p> : null}</div>
          <div className="mt-4 space-y-2">{order.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 text-sm"><div><span className="font-medium">{item.quantity}× {item.itemName}</span>{item.notes ? <p className="mt-0.5 text-xs text-[var(--mandys-foreground-muted)]">{item.notes}</p> : null}</div><span className="whitespace-nowrap">{money.format(item.lineTotalCents / 100)}</span></div>)}</div>
          {order.notes ? <p className="mt-4 rounded-md bg-[var(--mandys-surface-muted)] p-3 text-sm">{order.notes}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">{transitions[order.status].map((action) => <Button key={action.status} size="sm" variant={action.status === "cancelled" ? "secondary" : "primary"} disabled={busyId === order.id} onClick={() => void changeStatus(order.id, action.status)}>{c[action.key]}</Button>)}</div>
        </article>)}</div>}
    </div>
  );
}
