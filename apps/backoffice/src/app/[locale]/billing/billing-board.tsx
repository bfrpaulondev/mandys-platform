"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Subscription = { id: string; planKey: string; planName: string; status: string; trialStartedAt: string | null; trialEndsAt: string | null; currentPeriodStartedAt: string | null; currentPeriodEndsAt: string | null; cancelAtPeriodEnd: boolean; provider: string | null; createdAt: string };
type Plan = { planKey: string; displayName: string; position: number; monthlyPriceCents: number | null; annualPriceCents: number | null; currency: string; isPublic: boolean; modules: string[] };
type Entitlement = { moduleKey: string; status: string; enabledAt: string | null; expiresAt: string | null };
type BillingResponse = { data: { subscription: Subscription; plans: Plan[]; entitlements: Entitlement[] } };
type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": { subtitle: "O núcleo comercial já separa plano, período de teste e módulos ativos. O checkout só será ligado quando os preços e o provedor de pagamento estiverem definidos.", current: "Plano atual", status: "Estado", trialUntil: "Teste até", periodUntil: "Período até", provider: "Cobrança", notConnected: "Ainda não ligada", activeModules: "Módulos ativos", plans: "Arquitetura de planos", pricingPending: "Preço ainda não publicado", currentBadge: "Atual", loading: "A carregar subscrição…", refresh: "Atualizar", start: "Essencial para publicar e receber reservas", grow: "Relacionamento e eventos", operate: "Operação completa com pedidos, stock e analytics", intelligence: "Operação com Mandy's AI", multi: "Grupos e múltiplas localizações" },
  "pt-BR": { subtitle: "O núcleo comercial já separa plano, período de teste e módulos ativos. O checkout só será ligado quando os preços e o provedor de pagamento estiverem definidos.", current: "Plano atual", status: "Status", trialUntil: "Teste até", periodUntil: "Período até", provider: "Cobrança", notConnected: "Ainda não conectada", activeModules: "Módulos ativos", plans: "Arquitetura de planos", pricingPending: "Preço ainda não publicado", currentBadge: "Atual", loading: "Carregando assinatura…", refresh: "Atualizar", start: "Essencial para publicar e receber reservas", grow: "Relacionamento e eventos", operate: "Operação completa com pedidos, estoque e analytics", intelligence: "Operação com Mandy's AI", multi: "Grupos e múltiplas localizações" },
  en: { subtitle: "The commercial core now separates plan, trial period and active modules. Checkout will only be connected once pricing and the payment provider are defined.", current: "Current plan", status: "Status", trialUntil: "Trial until", periodUntil: "Period until", provider: "Billing", notConnected: "Not connected yet", activeModules: "Active modules", plans: "Plan architecture", pricingPending: "Pricing not published yet", currentBadge: "Current", loading: "Loading subscription…", refresh: "Refresh", start: "Essentials to publish and receive bookings", grow: "Customer relationships and events", operate: "Full operations with orders, stock and analytics", intelligence: "Operations with Mandy's AI", multi: "Groups and multiple locations" },
  es: { subtitle: "El núcleo comercial ya separa plan, período de prueba y módulos activos. El checkout solo se conectará cuando estén definidos los precios y el proveedor de pago.", current: "Plan actual", status: "Estado", trialUntil: "Prueba hasta", periodUntil: "Período hasta", provider: "Cobro", notConnected: "Aún no conectado", activeModules: "Módulos activos", plans: "Arquitectura de planes", pricingPending: "Precio aún no publicado", currentBadge: "Actual", loading: "Cargando suscripción…", refresh: "Actualizar", start: "Esencial para publicar y recibir reservas", grow: "Relación con clientes y eventos", operate: "Operación completa con pedidos, stock y analytics", intelligence: "Operación con Mandy's AI", multi: "Grupos y múltiples ubicaciones" },
} as const satisfies Record<Locale, Record<string, string>>;

const moduleLabels: Record<string, string> = { core: "Core", menu: "Menu", reservations: "Reserve", crm: "CRM", events: "Events", orders: "Orders", stock: "Stock", analytics: "Insights", ai: "AI", multi_location: "Multi-location", loyalty: "Loyalty" };
async function readError(response: Response) { const body = (await response.json().catch(() => ({}))) as ErrorResponse; return body.message ?? `Request failed (${response.status})`; }

export function BillingBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [data, setData] = useState<BillingResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/billing/v1/billing", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as BillingResponse;
      setData(body.data);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unexpected error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const planDescriptions: Record<string, string> = { start: c.start, grow: c.grow, operate: c.operate, intelligence: c.intelligence, multi: c.multi };
  const enabled = data?.entitlements.filter((item) => item.status === "enabled" || item.status === "trial") ?? [];

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><p className="max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.subtitle}</p><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{c.refresh}</Button></div>
    {error ? <div className="rounded-md bg-[var(--mandys-surface-muted)] p-4 text-sm text-[var(--mandys-foreground-muted)]">{error}</div> : null}
    {loading && !data ? <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div> : null}
    {data ? <>
      <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--mandys-foreground-muted)]">{c.current}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{data.subscription.planName}</h2><span className="mt-3 inline-flex rounded-full bg-[var(--mandys-surface-muted)] px-3 py-1 text-xs font-medium">{data.subscription.status}</span></div><dl className="grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-[var(--mandys-foreground-muted)]">{c.status}</dt><dd className="mt-1 font-medium">{data.subscription.status}</dd></div><div><dt className="text-xs text-[var(--mandys-foreground-muted)]">{data.subscription.trialEndsAt ? c.trialUntil : c.periodUntil}</dt><dd className="mt-1 font-medium">{data.subscription.trialEndsAt ? dateFormatter.format(new Date(data.subscription.trialEndsAt)) : data.subscription.currentPeriodEndsAt ? dateFormatter.format(new Date(data.subscription.currentPeriodEndsAt)) : "—"}</dd></div><div><dt className="text-xs text-[var(--mandys-foreground-muted)]">{c.provider}</dt><dd className="mt-1 font-medium">{data.subscription.provider ?? c.notConnected}</dd></div></dl></div><div className="mt-6 border-t border-[var(--mandys-border)] pt-5"><h3 className="text-sm font-semibold">{c.activeModules}</h3><div className="mt-3 flex flex-wrap gap-2">{enabled.map((item) => <span key={item.moduleKey} className="rounded-full bg-[var(--mandys-surface-muted)] px-3 py-1.5 text-xs font-medium">{moduleLabels[item.moduleKey] ?? item.moduleKey}</span>)}</div></div></section>
      <section><h2 className="text-lg font-semibold">{c.plans}</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">{data.plans.map((plan) => <article key={plan.planKey} className={`rounded-[var(--mandys-radius-lg)] border bg-[var(--mandys-surface)] p-5 ${plan.planKey === data.subscription.planKey ? "border-[var(--mandys-accent)]" : "border-[var(--mandys-border)]"}`}><div className="flex items-start justify-between gap-2"><h3 className="text-lg font-semibold">{plan.displayName}</h3>{plan.planKey === data.subscription.planKey ? <span className="rounded-full bg-[var(--mandys-surface-muted)] px-2 py-1 text-[10px] font-medium">{c.currentBadge}</span> : null}</div><p className="mt-2 min-h-12 text-sm leading-5 text-[var(--mandys-foreground-muted)]">{planDescriptions[plan.planKey] ?? ""}</p><p className="mt-4 text-xs font-medium text-[var(--mandys-foreground-muted)]">{c.pricingPending}</p><div className="mt-4 flex flex-wrap gap-1.5">{plan.modules.map((module) => <span key={module} className="rounded bg-[var(--mandys-surface-muted)] px-2 py-1 text-[10px]">{moduleLabels[module] ?? module}</span>)}</div></article>)}</div></section>
    </> : null}
  </div>;
}
