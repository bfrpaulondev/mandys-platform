"use client";

import type { Locale } from "@mandys/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

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

const copy = {
  "pt-PT": { loading: "A verificar sessão…", unavailable: "Não foi possível verificar a sessão. Atualize a página para tentar novamente.", dashboard: "Painel", reservations: "Reservas", orders: "Pedidos", menu: "Menu", stock: "Stock", events: "Eventos", customers: "Clientes", insights: "Insights", notifications: "Notificações", team: "Equipa", profile: "Perfil", settings: "Operação", activity: "Atividade", billing: "Plano", data: "Dados", logout: "Sair" },
  "pt-BR": { loading: "Verificando sessão…", unavailable: "Não foi possível verificar a sessão. Atualize a página para tentar novamente.", dashboard: "Painel", reservations: "Reservas", orders: "Pedidos", menu: "Cardápio", stock: "Estoque", events: "Eventos", customers: "Clientes", insights: "Insights", notifications: "Notificações", team: "Equipe", profile: "Perfil", settings: "Operação", activity: "Atividade", billing: "Plano", data: "Dados", logout: "Sair" },
  en: { loading: "Checking session…", unavailable: "We couldn't verify the session. Refresh the page to try again.", dashboard: "Dashboard", reservations: "Reservations", orders: "Orders", menu: "Menu", stock: "Stock", events: "Events", customers: "Customers", insights: "Insights", notifications: "Notifications", team: "Team", profile: "Profile", settings: "Operations", activity: "Activity", billing: "Plan", data: "Data", logout: "Sign out" },
  es: { loading: "Verificando la sesión…", unavailable: "No se pudo verificar la sesión. Actualiza la página para intentarlo de nuevo.", dashboard: "Panel", reservations: "Reservas", orders: "Pedidos", menu: "Menú", stock: "Stock", events: "Eventos", customers: "Clientes", insights: "Insights", notifications: "Notificaciones", team: "Equipo", profile: "Perfil", settings: "Operación", activity: "Actividad", billing: "Plan", data: "Datos", logout: "Salir" },
} as const satisfies Record<Locale, Record<string, string>>;

function hasRole(role: string | null, allowed: readonly string[]) {
  return role !== null && allowed.includes(role);
}

export function SessionBoundary({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname.endsWith("/login");
  const [state, setState] = useState<"checking" | "ready" | "unavailable">(isLogin ? "ready" : "checking");
  const [role, setRole] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (isLogin) { setState("ready"); setRole(null); return; }
    let cancelled = false;
    setState("checking");
    void (async () => {
      try {
        const sessionResult = await authClient.getSession();
        if (cancelled) return;
        if (sessionResult.error) { setState("unavailable"); return; }
        if (!sessionResult.data) { router.replace(`/${locale}/login`); return; }

        if (!sessionResult.data.session.activeOrganizationId) {
          setRole(null);
          setState("ready");
          return;
        }

        const roleResult = await authClient.organization.getActiveMemberRole();
        if (cancelled) return;
        if (roleResult.error) { setState("unavailable"); return; }
        const activeRole = roleResult.data?.role;
        setRole(Array.isArray(activeRole) ? (activeRole[0] ?? null) : (activeRole ?? null));
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, [isLogin, locale, router]);

  async function signOut() {
    setSigningOut(true);
    try { await authClient.signOut(); router.replace(`/${locale}/login`); router.refresh(); }
    finally { setSigningOut(false); }
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
    return <><nav className="sticky top-0 z-40 border-b border-[var(--mandys-border)] bg-[var(--mandys-background)]/95 backdrop-blur" aria-label="Mandy's"><div className="mx-auto flex w-full max-w-[1500px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8"><Link href={`/${locale}`} className="mr-2 shrink-0 text-sm font-bold tracking-[-0.03em]">Mandy&apos;s</Link>{links.map((link) => { const active = link.exact ? pathname === link.href : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-[var(--mandys-foreground)] text-[var(--mandys-background)]" : "text-[var(--mandys-foreground-muted)] hover:bg-[var(--mandys-surface-muted)] hover:text-[var(--mandys-foreground)]"}`}>{link.label}</Link>; })}<button type="button" onClick={() => void signOut()} disabled={signingOut} className="ml-auto shrink-0 rounded-lg border border-[var(--mandys-border)] px-3 py-2 text-sm font-medium disabled:opacity-60">{signingOut ? "…" : c.logout}</button></div></nav>{children}</>;
  }

  return <main className="grid min-h-screen place-items-center px-6"><div className="max-w-md rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-center shadow-[var(--mandys-shadow-sm)]"><p className="text-sm text-[var(--mandys-foreground-muted)]">{state === "checking" ? copy[locale].loading : copy[locale].unavailable}</p></div></main>;
}