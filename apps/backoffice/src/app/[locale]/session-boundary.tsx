"use client";

import type { Locale } from "@mandys/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { authClient } from "../../lib/auth-client";

const operationalRoles = ["owner", "manager", "reception", "kitchen", "staff", "marketing", "accounting"] as const;
const reservationRoles = ["owner", "manager", "reception", "kitchen", "staff"] as const;
const orderRoles = ["owner", "manager", "reception", "kitchen", "staff"] as const;
const menuRoles = operationalRoles;
const stockRoles = ["owner", "manager", "kitchen", "staff", "accounting"] as const;
const eventRoles = ["owner", "manager", "reception", "marketing"] as const;
const customerRoles = ["owner", "manager", "reception"] as const;
const insightRoles = ["owner", "manager", "reception", "marketing", "accounting"] as const;
const adminRoles = ["owner", "manager"] as const;
const billingRoles = ["owner", "manager", "accounting"] as const;
const sessionRequestTimeoutMs = 8_000;
const sessionRequestAttempts = 2;

const copy = {
  "pt-PT": { loading: "A verificar sessão…", unavailable: "Não foi possível verificar a sessão.", retry: "Tentar novamente", dashboard: "Painel", reservations: "Reservas", orders: "Pedidos", menu: "Menu", stock: "Stock", events: "Eventos", customers: "Clientes", insights: "Insights", notifications: "Notificações", team: "Equipa", profile: "Perfil", settings: "Operação", activity: "Atividade", billing: "Plano", data: "Dados", logout: "Sair" },
  "pt-BR": { loading: "Verificando sessão…", unavailable: "Não foi possível verificar a sessão.", retry: "Tentar novamente", dashboard: "Painel", reservations: "Reservas", orders: "Pedidos", menu: "Cardápio", stock: "Estoque", events: "Eventos", customers: "Clientes", insights: "Insights", notifications: "Notificações", team: "Equipe", profile: "Perfil", settings: "Operação", activity: "Atividade", billing: "Plano", data: "Dados", logout: "Sair" },
  en: { loading: "Checking session…", unavailable: "We couldn't verify the session.", retry: "Try again", dashboard: "Dashboard", reservations: "Reservations", orders: "Orders", menu: "Menu", stock: "Stock", events: "Events", customers: "Customers", insights: "Insights", notifications: "Notifications", team: "Team", profile: "Profile", settings: "Operations", activity: "Activity", billing: "Plan", data: "Data", logout: "Sign out" },
  es: { loading: "Verificando la sesión…", unavailable: "No se pudo verificar la sesión.", retry: "Intentar de nuevo", dashboard: "Panel", reservations: "Reservas", orders: "Pedidos", menu: "Menú", stock: "Stock", events: "Eventos", customers: "Clientes", insights: "Insights", notifications: "Notificaciones", team: "Equipo", profile: "Perfil", settings: "Operación", activity: "Actividad", billing: "Plan", data: "Datos", logout: "Salir" },
} as const satisfies Record<Locale, Record<string, string>>;

type ProtectedContextResponse = {
  data?: { currentRole?: string };
  error?: string;
  message?: string;
};

function hasRole(role: string | null, allowed: readonly string[]) {
  return role !== null && allowed.includes(role);
}

function dataPrefetchForHref(href: string): string | null {
  if (href.endsWith("/menu")) return "/api/menu/v1/menu";
  if (href.endsWith("/orders")) return "/api/orders/v1/orders?limit=200";
  if (href.endsWith("/customers")) return "/api/crm/v1/customers";
  if (href.endsWith("/stock")) return "/api/stock/v1/stock";
  if (href.endsWith("/notifications")) return "/api/notifications/v1/notifications?limit=150";
  return null;
}

async function fetchProtectedContext(): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= sessionRequestAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), sessionRequestTimeoutMs);
    try {
      const response = await fetch("/api/dashboard", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status < 500 || attempt === sessionRequestAttempts) return response;
      lastError = new Error(`Dashboard session check returned ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === sessionRequestAttempts) throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
  }
  throw lastError ?? new Error("Dashboard session check failed");
}

export function SessionBoundary({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname.endsWith("/login");
  const checkedRef = useRef(false);
  const warmedDataRef = useRef(new Set<string>());
  const [state, setState] = useState<"checking" | "ready" | "unavailable">(isLogin ? "ready" : "checking");
  const [role, setRole] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [checkRevision, setCheckRevision] = useState(0);

  useEffect(() => {
    if (isLogin) {
      checkedRef.current = false;
      setState("ready");
      setRole(null);
      return;
    }
    if (checkedRef.current) return;
    checkedRef.current = true;

    let cancelled = false;
    setState("checking");
    void (async () => {
      try {
        const onboardingPath = `/${locale}/onboarding`;
        const loginPath = `/${locale}/login`;

        if (pathname.startsWith(onboardingPath)) {
          const sessionResult = await authClient.getSession();
          if (cancelled) return;
          if (sessionResult.error) { setState("unavailable"); return; }
          if (!sessionResult.data) { router.replace(loginPath); return; }
          setRole(null);
          setState("ready");
          return;
        }

        // The fast dashboard snapshot already resolves the opaque Better Auth
        // session, active organization and role in one Edge-backed request.
        // Reuse it for every protected entrypoint instead of calling core again.
        // A stalled edge/network request is aborted and retried once so a transient
        // reset cannot leave the application on "Checking session…" indefinitely.
        const response = await fetchProtectedContext();
        const body = (await response.json().catch(() => null)) as ProtectedContextResponse | null;
        if (cancelled) return;

        if (response.status === 401 && body?.error === "TENANT_CONTEXT_REQUIRED") {
          router.replace(onboardingPath);
          return;
        }
        if (response.status === 401) {
          router.replace(loginPath);
          return;
        }
        if (!response.ok) {
          setState("unavailable");
          return;
        }

        const activeRole = body?.data?.currentRole;
        if (typeof activeRole !== "string" || activeRole.length === 0) {
          setState("unavailable");
          return;
        }
        setRole(activeRole);
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, [checkRevision, isLogin, locale, pathname, router]);

  function retrySessionCheck() {
    checkedRef.current = false;
    setCheckRevision((value) => value + 1);
  }

  function warmNavigation(href: string) {
    router.prefetch(href);
    const dataUrl = dataPrefetchForHref(href);
    if (!dataUrl || warmedDataRef.current.has(dataUrl)) return;
    warmedDataRef.current.add(dataUrl);
    void fetch(dataUrl, { credentials: "include" }).catch(() => {
      warmedDataRef.current.delete(dataUrl);
    });
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      checkedRef.current = false;
      warmedDataRef.current.clear();
      router.replace(`/${locale}/login`);
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  if (state === "ready" && isLogin) return children;

  if (state === "ready") {
    const c = copy[locale];
    const links = [
      { href: `/${locale}`, label: c.dashboard, exact: true, roles: operationalRoles },
      { href: `/${locale}/reservations`, label: c.reservations, roles: reservationRoles },
      { href: `/${locale}/orders`, label: c.orders, roles: orderRoles },
      { href: `/${locale}/menu`, label: c.menu, roles: menuRoles },
      { href: `/${locale}/stock`, label: c.stock, roles: stockRoles },
      { href: `/${locale}/events`, label: c.events, roles: eventRoles },
      { href: `/${locale}/customers`, label: c.customers, roles: customerRoles },
      { href: `/${locale}/insights`, label: c.insights, roles: insightRoles },
      { href: `/${locale}/notifications`, label: c.notifications, roles: operationalRoles },
      { href: `/${locale}/team`, label: c.team, roles: adminRoles },
      { href: `/${locale}/profile`, label: c.profile, roles: adminRoles },
      { href: `/${locale}/settings`, label: c.settings, roles: adminRoles },
      { href: `/${locale}/activity`, label: c.activity, roles: adminRoles },
      { href: `/${locale}/billing`, label: c.billing, roles: billingRoles },
      { href: `/${locale}/data`, label: c.data, roles: ["owner"] as const },
    ].filter((link) => hasRole(role, link.roles));

    return (
      <>
        <nav className="sticky top-0 z-40 border-b border-[var(--mandys-border)] bg-[var(--mandys-background)]/95 backdrop-blur" aria-label="Mandy's">
          <div className="mx-auto flex w-full max-w-[1500px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            <Link href={`/${locale}`} prefetch className="mr-2 shrink-0 text-sm font-bold tracking-[-0.03em]" onMouseEnter={() => warmNavigation(`/${locale}`)} onFocus={() => warmNavigation(`/${locale}`)}>Mandy&apos;s</Link>
            {links.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} prefetch aria-current={active ? "page" : undefined} onMouseEnter={() => warmNavigation(link.href)} onFocus={() => warmNavigation(link.href)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-[var(--mandys-foreground)] text-[var(--mandys-background)]" : "text-[var(--mandys-foreground-muted)] hover:bg-[var(--mandys-surface-muted)] hover:text-[var(--mandys-foreground)]"}`}>
                  {link.label}
                </Link>
              );
            })}
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className="ml-auto shrink-0 rounded-lg border border-[var(--mandys-border)] px-3 py-2 text-sm font-medium disabled:opacity-60">
              {signingOut ? "…" : c.logout}
            </button>
          </div>
        </nav>
        {children}
      </>
    );
  }

  const c = copy[locale];
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-center shadow-[var(--mandys-shadow-sm)]">
        <p className="text-sm text-[var(--mandys-foreground-muted)]">{state === "checking" ? c.loading : c.unavailable}</p>
        {state === "unavailable" ? (
          <button type="button" onClick={retrySessionCheck} className="mt-4 rounded-xl border border-[var(--mandys-border)] px-4 py-2 text-sm font-medium">
            {c.retry}
          </button>
        ) : null}
      </div>
    </main>
  );
}
