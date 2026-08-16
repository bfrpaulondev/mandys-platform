"use client";

import type { Locale } from "@mandys/i18n";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { authClient } from "../../lib/auth-client";

const copy = {
  "pt-PT": {
    loading: "A verificar sessão…",
    unavailable: "Não foi possível verificar a sessão. Atualize a página para tentar novamente.",
  },
  "pt-BR": {
    loading: "Verificando sessão…",
    unavailable: "Não foi possível verificar a sessão. Atualize a página para tentar novamente.",
  },
  en: {
    loading: "Checking session…",
    unavailable: "We couldn't verify the session. Refresh the page to try again.",
  },
  es: {
    loading: "Verificando la sesión…",
    unavailable: "No se pudo verificar la sesión. Actualiza la página para intentarlo de nuevo.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function SessionBoundary({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "unavailable">(
    pathname.endsWith("/login") ? "ready" : "checking",
  );

  useEffect(() => {
    if (pathname.endsWith("/login")) {
      setState("ready");
      return;
    }

    let cancelled = false;
    setState("checking");

    void authClient.getSession().then((result) => {
      if (cancelled) return;
      if (result.error) {
        setState("unavailable");
        return;
      }
      if (!result.data) {
        router.replace(`/${locale}/login`);
        return;
      }
      setState("ready");
    }).catch(() => {
      if (!cancelled) setState("unavailable");
    });

    return () => {
      cancelled = true;
    };
  }, [locale, pathname, router]);

  if (state === "ready") return children;

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-center shadow-[var(--mandys-shadow-sm)]">
        <p className="text-sm text-[var(--mandys-foreground-muted)]">
          {state === "checking" ? copy[locale].loading : copy[locale].unavailable}
        </p>
      </div>
    </main>
  );
}
