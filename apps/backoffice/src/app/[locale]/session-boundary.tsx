"use client";

import type { Locale } from "@mandys/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { authClient } from "../../lib/auth-client";

const copy = {
  "pt-PT": { loading: "A verificar sessão…", unavailable: "Não foi possível verificar a sessão. Atualize a página para tentar novamente.", dashboard: "Painel", reservations: "Reservas", menu: "Menu", events: "Eventos", customers: "Clientes", team: "Equipa", profile: "Perfil", settings: "Operação", activity: "Atividade", logout: "Sair" },
  "pt-BR": { loading: "Verificando sessão…", unavailable: "Não foi possível verificar a sessão. Atualize a página para tentar novamente.", dashboard: "Painel", reservations: "Reservas", menu: "Cardápio", events: "Eventos", customers: "Clientes", team: "Equipe", profile: "Perfil", settings: "Operação", activity: "Atividade", logout: "Sair" },
  en: { loading: "Checking session…", unavailable: "We couldn't verify the session. Refresh the page to try again.", dashboard: "Dashboard", reservations: "Reservations", menu: "Menu", events: "Events", customers: "Customers", team: "Team", profile: "Profile", settings: "Operations", activity: "Activity", logout: "Sign out" },
  es: { loading: "Verificando la sesión…", unavailable: "No se pudo verificar la sesión. Actualiza la página para intentarlo de nuevo.", dashboard: "Panel", reservations: "Reservas", menu: "Menú", events: "Eventos", customers: "Clientes", team: "Equipo", profile: "Perfil", settings: "Operación", activity: "Actividad", logout: "Salir" },
} as const satisfies Record<Locale, Record<string, string>>;

export function SessionBoundary({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname.endsWith("/login");
  const [state, setState] = useState<"checking" | "ready" | "unavailable">(isLogin ? "ready" : "checking");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (isLogin) { setState("ready"); return; }
    let cancelled = false;
    setState("checking");
    void authClient.getSession().then((result) => {
      if (cancelled) return;
      if (result.error) { setState("unavailable"); return; }
      if (!result.data) { router.replace(`/${locale}/login`); return; }
      setState("ready");
    }).catch(() => { if (!cancelled) setState("unavailable"); });
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
      { href: `/${locale}`, label: c.dashboard, exact: true },
      { href: `/${locale}/reservations`, label: c.reservations },
      { href: `/${locale}/menu`, label: c.menu },
      { href: `/${locale}/events`, label: c.events },
      { href: `/${locale}/customers`, label: c.customers },
      { href: `/${locale}/team`, label: c.team },
      { href: `/${locale}/profile`, label: c.profile },
      { href: `/${locale}/settings`, label: c.settings },
      { href: `/${locale}/activity`, label: c.activity },
    ];
    return <><nav className="sticky top-0 z-40 border-b border-[var(--mandys-border)] bg-[var(--mandys-background)]/95 backdrop-blur" aria-label="Mandy's"><div className="mx-auto flex w-full max-w-[1500px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8"><Link href={`/${locale}`} className="mr-2 shrink-0 text-sm font-bold tracking-[-0.03em]">Mandy&apos;s</Link>{links.map((link) => { const active = link.exact ? pathname === link.href : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-[var(--mandys-foreground)] text-[var(--mandys-background)]" : "text-[var(--mandys-foreground-muted)] hover:bg-[var(--mandys-surface-muted)] hover:text-[var(--mandys-foreground)]"}`}>{link.label}</Link>; })}<button type="button" onClick={() => void signOut()} disabled={signingOut} className="ml-auto shrink-0 rounded-lg border border-[var(--mandys-border)] px-3 py-2 text-sm font-medium disabled:opacity-60">{signingOut ? "…" : c.logout}</button></div></nav>{children}</>;
  }

  return <main className="grid min-h-screen place-items-center px-6"><div className="max-w-md rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-center shadow-[var(--mandys-shadow-sm)]"><p className="text-sm text-[var(--mandys-foreground-muted)]">{state === "checking" ? copy[locale].loading : copy[locale].unavailable}</p></div></main>;
}
