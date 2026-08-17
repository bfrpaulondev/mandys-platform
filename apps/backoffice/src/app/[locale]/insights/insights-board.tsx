"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Insights = {
  days: number; currency: string; timezone: string;
  reservations: { total: number; covers: number; completed: number; confirmed: number; cancelled: number; noShow: number; noShowRate: number };
  events: { total: number; won: number; lost: number; pipelineCents: number; winRate: number };
  orders: { total: number; completed: number; cancelled: number; revenueCents: number; averageTicketCents: number };
  customers: { total: number; newCustomers: number; returningCustomers: number };
  menu: { totalItems: number; availableItems: number; publishedMenus: number };
  stock: { ingredients: number; lowStock: number; estimatedValueCents: number };
  trend: Array<{ day: string; reservations: number; covers: number; orders: number; revenueCents: number; eventLeads: number }>;
};
type InsightsResponse = { data: Insights };
type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": { subtitle: "Uma leitura única da operação: procura, clientes, eventos, pedidos, menu e stock.", seven: "7 dias", thirty: "30 dias", ninety: "90 dias", refresh: "Atualizar", loading: "A calcular indicadores…", reservations: "Reservas", covers: "Pessoas", noShow: "No-show", customers: "Clientes", newCustomers: "Novos clientes", returning: "Recorrentes", events: "Pedidos de evento", winRate: "Conversão de eventos", pipeline: "Pipeline estimado", orders: "Pedidos takeaway", revenue: "Receita concluída", avgTicket: "Ticket médio", menuItems: "Itens no menu", available: "Disponíveis", lowStock: "Ingredientes a repor", stockValue: "Valor de stock", trend: "Evolução diária", noData: "Ainda não há movimento suficiente neste período." },
  "pt-BR": { subtitle: "Uma leitura única da operação: demanda, clientes, eventos, pedidos, cardápio e estoque.", seven: "7 dias", thirty: "30 dias", ninety: "90 dias", refresh: "Atualizar", loading: "Calculando indicadores…", reservations: "Reservas", covers: "Pessoas", noShow: "No-show", customers: "Clientes", newCustomers: "Novos clientes", returning: "Recorrentes", events: "Pedidos de evento", winRate: "Conversão de eventos", pipeline: "Pipeline estimado", orders: "Pedidos takeaway", revenue: "Receita concluída", avgTicket: "Ticket médio", menuItems: "Itens no cardápio", available: "Disponíveis", lowStock: "Ingredientes a repor", stockValue: "Valor de estoque", trend: "Evolução diária", noData: "Ainda não há movimento suficiente neste período." },
  en: { subtitle: "One operational view across demand, customers, events, orders, menu and stock.", seven: "7 days", thirty: "30 days", ninety: "90 days", refresh: "Refresh", loading: "Calculating metrics…", reservations: "Reservations", covers: "Covers", noShow: "No-show", customers: "Customers", newCustomers: "New customers", returning: "Returning", events: "Event enquiries", winRate: "Event conversion", pipeline: "Estimated pipeline", orders: "Takeaway orders", revenue: "Completed revenue", avgTicket: "Average ticket", menuItems: "Menu items", available: "Available", lowStock: "Ingredients to reorder", stockValue: "Stock value", trend: "Daily trend", noData: "There is not enough activity in this period yet." },
  es: { subtitle: "Una visión única de la operación: demanda, clientes, eventos, pedidos, carta y stock.", seven: "7 días", thirty: "30 días", ninety: "90 días", refresh: "Actualizar", loading: "Calculando indicadores…", reservations: "Reservas", covers: "Personas", noShow: "No-show", customers: "Clientes", newCustomers: "Nuevos clientes", returning: "Recurrentes", events: "Solicitudes de evento", winRate: "Conversión de eventos", pipeline: "Pipeline estimado", orders: "Pedidos takeaway", revenue: "Ingresos completados", avgTicket: "Ticket medio", menuItems: "Artículos de carta", available: "Disponibles", lowStock: "Ingredientes a reponer", stockValue: "Valor de stock", trend: "Evolución diaria", noData: "Todavía no hay suficiente actividad en este período." },
} as const satisfies Record<Locale, Record<string, string>>;

async function readError(response: Response) { const body = (await response.json().catch(() => ({}))) as ErrorResponse; return body.message ?? `Request failed (${response.status})`; }

export function InsightsBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/insights/v1/insights?days=${days}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as InsightsResponse;
      setData(body.data);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unexpected error"); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: data?.currency ?? "EUR" }), [data?.currency, locale]);
  const percent = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }), [locale]);
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }), [locale]);
  const maxTrend = data ? Math.max(1, ...data.trend.map((row) => Math.max(row.covers, row.orders, row.eventLeads))) : 1;
  const cards = data ? [
    { label: c.reservations, value: String(data.reservations.total), sub: `${data.reservations.covers} ${c.covers}` },
    { label: c.noShow, value: percent.format(data.reservations.noShowRate), sub: String(data.reservations.noShow) },
    { label: c.customers, value: String(data.customers.total), sub: `${data.customers.newCustomers} ${c.newCustomers.toLowerCase()}` },
    { label: c.returning, value: String(data.customers.returningCustomers), sub: c.customers },
    { label: c.events, value: String(data.events.total), sub: `${c.winRate}: ${percent.format(data.events.winRate)}` },
    { label: c.pipeline, value: money.format(data.events.pipelineCents / 100), sub: c.events },
    { label: c.orders, value: String(data.orders.total), sub: `${data.orders.completed} completed` },
    { label: c.revenue, value: money.format(data.orders.revenueCents / 100), sub: `${c.avgTicket}: ${money.format(data.orders.averageTicketCents / 100)}` },
    { label: c.menuItems, value: String(data.menu.totalItems), sub: `${data.menu.availableItems} ${c.available.toLowerCase()}` },
    { label: c.lowStock, value: String(data.stock.lowStock), sub: `${data.stock.ingredients} total` },
    { label: c.stockValue, value: money.format(data.stock.estimatedValueCents / 100), sub: c.lowStock },
  ] : [];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><p className="max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p><div className="flex flex-wrap gap-2"><div className="flex rounded-lg bg-[var(--mandys-surface-muted)] p-1">{[{ d: 7, label: c.seven }, { d: 30, label: c.thirty }, { d: 90, label: c.ninety }].map((option) => <button key={option.d} type="button" onClick={() => setDays(option.d)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${days === option.d ? "bg-[var(--mandys-surface)] shadow-sm" : "text-[var(--mandys-foreground-muted)]"}`}>{option.label}</button>)}</div><Button variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>{c.refresh}</Button></div></div>
    {error ? <div className="rounded-md bg-[var(--mandys-surface-muted)] p-4 text-sm text-[var(--mandys-foreground-muted)]">{error}</div> : null}
    {loading && !data ? <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div> : null}
    {data ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <article key={card.label} className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4"><div className="text-2xl font-semibold tracking-[-0.04em]">{card.value}</div><div className="mt-1 text-sm font-medium">{card.label}</div><div className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{card.sub}</div></article>)}</div>
      <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6"><h2 className="font-semibold">{c.trend}</h2>{data.trend.some((row) => row.covers > 0 || row.orders > 0 || row.eventLeads > 0) ? <div className="mt-6 flex min-h-56 items-end gap-1 overflow-x-auto pb-1">{data.trend.map((row) => <div key={row.day} className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1"><div className="flex h-40 w-full items-end justify-center gap-px"><div title={`${c.covers}: ${row.covers}`} className="w-2 rounded-t bg-[var(--mandys-foreground)] opacity-80" style={{ height: `${Math.max(row.covers > 0 ? 5 : 0, (row.covers / maxTrend) * 100)}%` }} /><div title={`${c.orders}: ${row.orders}`} className="w-2 rounded-t bg-[var(--mandys-accent)]" style={{ height: `${Math.max(row.orders > 0 ? 5 : 0, (row.orders / maxTrend) * 100)}%` }} /><div title={`${c.events}: ${row.eventLeads}`} className="w-2 rounded-t bg-[var(--mandys-foreground-muted)] opacity-60" style={{ height: `${Math.max(row.eventLeads > 0 ? 5 : 0, (row.eventLeads / maxTrend) * 100)}%` }} /></div><span className="whitespace-nowrap text-[10px] text-[var(--mandys-foreground-muted)]">{dayFormatter.format(new Date(`${row.day}T12:00:00`))}</span></div>)}</div> : <p className="mt-5 text-sm text-[var(--mandys-foreground-muted)]">{c.noData}</p>}</section></> : null}
  </div>;
}
