"use client";

import { Button, ErrorState, LoadingState, Surface, useToast } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { describeDevice, formatSessionDate } from "./session-utils";

const copy = {
  "pt-PT": { title: "Sessões e dispositivos", subtitle: "Veja onde a sua conta está autenticada e termine acessos que já não reconhece.", loading: "A carregar sessões…", loadError: "Não foi possível carregar as sessões ativas.", retry: "Tentar novamente", current: "Sessão atual", lastSeen: "Atualizada", expires: "Expira", ip: "IP", revoke: "Terminar sessão", revoking: "A terminar…", revokeOthers: "Terminar outras sessões", revokingOthers: "A terminar outras…", revoked: "Sessão terminada.", othersRevoked: "As outras sessões foram terminadas.", actionError: "Não foi possível terminar a sessão.", none: "Não existem outras sessões ativas." },
  "pt-BR": { title: "Sessões e dispositivos", subtitle: "Veja onde sua conta está autenticada e encerre acessos que você não reconhece.", loading: "Carregando sessões…", loadError: "Não foi possível carregar as sessões ativas.", retry: "Tentar novamente", current: "Sessão atual", lastSeen: "Atualizada", expires: "Expira", ip: "IP", revoke: "Encerrar sessão", revoking: "Encerrando…", revokeOthers: "Encerrar outras sessões", revokingOthers: "Encerrando outras…", revoked: "Sessão encerrada.", othersRevoked: "As outras sessões foram encerradas.", actionError: "Não foi possível encerrar a sessão.", none: "Não existem outras sessões ativas." },
  en: { title: "Sessions and devices", subtitle: "Review where your account is signed in and end access you no longer recognize.", loading: "Loading sessions…", loadError: "We couldn't load active sessions.", retry: "Try again", current: "Current session", lastSeen: "Updated", expires: "Expires", ip: "IP", revoke: "End session", revoking: "Ending…", revokeOthers: "End other sessions", revokingOthers: "Ending others…", revoked: "Session ended.", othersRevoked: "Other sessions ended.", actionError: "We couldn't end the session.", none: "There are no other active sessions." },
  es: { title: "Sesiones y dispositivos", subtitle: "Revisa dónde está iniciada tu cuenta y cierra accesos que ya no reconozcas.", loading: "Cargando sesiones…", loadError: "No se pudieron cargar las sesiones activas.", retry: "Intentar de nuevo", current: "Sesión actual", lastSeen: "Actualizada", expires: "Caduca", ip: "IP", revoke: "Cerrar sesión", revoking: "Cerrando…", revokeOthers: "Cerrar otras sesiones", revokingOthers: "Cerrando otras…", revoked: "Sesión cerrada.", othersRevoked: "Las otras sesiones se cerraron.", actionError: "No se pudo cerrar la sesión.", none: "No hay otras sesiones activas." },
} as const;

type SupportedLocale = keyof typeof copy;
type SessionRecord = { token: string; userAgent?: string | null; ipAddress?: string | null; updatedAt?: string | Date | null; expiresAt?: string | Date | null };

export function SessionManagement({ locale }: { locale: SupportedLocale }) {
  const c = copy[locale];
  const toast = useToast();
  const current = authClient.useSession();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const currentToken = (current.data?.session as { token?: string } | undefined)?.token;

  const loadSessions = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const result = await authClient.listSessions();
      if (result.error || !result.data) { setLoadError(true); return; }
      setSessions(result.data as SessionRecord[]);
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const hasOtherSessions = useMemo(() => sessions.some((session) => session.token !== currentToken), [sessions, currentToken]);

  async function revoke(token: string) {
    if (token === currentToken || revokingToken) return;
    setRevokingToken(token);
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) { toast.error(c.actionError); return; }
      setSessions((items) => items.filter((item) => item.token !== token));
      toast.success(c.revoked);
    } catch { toast.error(c.actionError); } finally { setRevokingToken(null); }
  }

  async function revokeOthers() {
    if (!hasOtherSessions || revokingOthers) return;
    setRevokingOthers(true);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) { toast.error(c.actionError); return; }
      setSessions((items) => items.filter((item) => item.token === currentToken));
      toast.success(c.othersRevoked);
    } catch { toast.error(c.actionError); } finally { setRevokingOthers(false); }
  }

  if (loading || current.isPending) return <LoadingState label={c.loading} rows={3} />;
  if (loadError || current.error || !current.data) return <ErrorState title={c.loadError} description={c.loadError} retryLabel={c.retry} onRetry={() => void loadSessions()} />;

  return (
    <Surface className="max-w-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-base font-semibold">{c.title}</h2><p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p></div>
        <Button type="button" variant="secondary" disabled={!hasOtherSessions || revokingOthers} aria-busy={revokingOthers} onClick={() => void revokeOthers()}>{revokingOthers ? c.revokingOthers : c.revokeOthers}</Button>
      </div>

      <div className="mt-5 space-y-3">
        {sessions.map((session) => {
          const isCurrent = session.token === currentToken;
          return (
            <div key={session.token} className="rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{describeDevice(session.userAgent)}</p>{isCurrent ? <span className="rounded-full border border-[var(--mandys-border)] px-2 py-0.5 text-xs">{c.current}</span> : null}</div>
                  <dl className="mt-2 grid gap-x-5 gap-y-1 text-xs text-[var(--mandys-foreground-muted)] sm:grid-cols-2">
                    <div><dt className="inline font-medium">{c.lastSeen}: </dt><dd className="inline">{formatSessionDate(session.updatedAt, locale)}</dd></div>
                    <div><dt className="inline font-medium">{c.expires}: </dt><dd className="inline">{formatSessionDate(session.expiresAt, locale)}</dd></div>
                    <div><dt className="inline font-medium">{c.ip}: </dt><dd className="inline">{session.ipAddress || "—"}</dd></div>
                  </dl>
                </div>
                {!isCurrent ? <Button type="button" variant="secondary" disabled={revokingToken === session.token} aria-busy={revokingToken === session.token} onClick={() => void revoke(session.token)}>{revokingToken === session.token ? c.revoking : c.revoke}</Button> : null}
              </div>
            </div>
          );
        })}
        {!hasOtherSessions && sessions.length <= 1 ? <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.none}</p> : null}
      </div>
    </Surface>
  );
}
