"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "../../../../lib/auth-client";

type InvitationView = {
  id: string;
  email: string;
  role: string | string[];
  organizationId: string;
  status: string;
  expiresAt: string | Date;
  organization?: { id?: string; name?: string } | null;
};

const copy = {
  "pt-PT": { loading: "A verificar convite…", signIn: "Entre ou crie uma conta com o email convidado para continuar.", signInButton: "Entrar para continuar", title: "Convite para a equipa", invited: "Foi convidado para", role: "Função", expires: "Expira", accept: "Aceitar convite", reject: "Recusar convite", accepting: "A aceitar…", rejected: "Convite recusado.", invalid: "Este convite não está disponível, expirou ou não pertence ao email desta conta." },
  "pt-BR": { loading: "Verificando convite…", signIn: "Entre ou crie uma conta com o e-mail convidado para continuar.", signInButton: "Entrar para continuar", title: "Convite para a equipe", invited: "Você foi convidado para", role: "Função", expires: "Expira", accept: "Aceitar convite", reject: "Recusar convite", accepting: "Aceitando…", rejected: "Convite recusado.", invalid: "Este convite não está disponível, expirou ou não pertence ao e-mail desta conta." },
  en: { loading: "Checking invitation…", signIn: "Sign in or create an account with the invited email to continue.", signInButton: "Sign in to continue", title: "Team invitation", invited: "You were invited to", role: "Role", expires: "Expires", accept: "Accept invitation", reject: "Decline invitation", accepting: "Accepting…", rejected: "Invitation declined.", invalid: "This invitation is unavailable, expired, or does not belong to this account email." },
  es: { loading: "Comprobando invitación…", signIn: "Inicia sesión o crea una cuenta con el correo invitado para continuar.", signInButton: "Entrar para continuar", title: "Invitación al equipo", invited: "Has sido invitado a", role: "Rol", expires: "Caduca", accept: "Aceptar invitación", reject: "Rechazar invitación", accepting: "Aceptando…", rejected: "Invitación rechazada.", invalid: "Esta invitación no está disponible, ha caducado o no pertenece al correo de esta cuenta." },
} as const;

export function InvitationCard({ locale, invitationId }: { locale: Locale; invitationId: string }) {
  const c = copy[locale];
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await authClient.getSession();
        if (!active) return;
        if (!session.data) { setSignedIn(false); return; }
        setSignedIn(true);
        const result = await authClient.organization.getInvitation({ query: { id: invitationId } });
        if (!active) return;
        if (result.error || !result.data) { setError(result.error?.message ?? c.invalid); return; }
        setInvitation(result.data as unknown as InvitationView);
      } catch { if (active) setError(c.invalid); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [c.invalid, invitationId]);

  async function accept() {
    if (!invitation) return;
    setBusy(true); setError(null);
    try {
      const result = await authClient.organization.acceptInvitation({ invitationId });
      if (result.error) { setError(result.error.message ?? c.invalid); return; }
      await authClient.organization.setActive({ organizationId: invitation.organizationId });
      router.push(`/${locale}`); router.refresh();
    } catch { setError(c.invalid); }
    finally { setBusy(false); }
  }

  async function reject() {
    setBusy(true); setError(null);
    try {
      const result = await authClient.organization.rejectInvitation({ invitationId });
      if (result.error) { setError(result.error.message ?? c.invalid); return; }
      setRejected(true); setInvitation(null);
    } catch { setError(c.invalid); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</p>;
  if (!signedIn) {
    const next = `/${locale}/invite/${encodeURIComponent(invitationId)}`;
    return <div className="space-y-4"><p className="text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.signIn}</p><Link href={`/${locale}/login?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--mandys-foreground)] px-4 py-2 text-sm font-semibold text-[var(--mandys-background)]">{c.signInButton}</Link></div>;
  }
  if (rejected) return <p role="status" className="rounded-xl border border-[var(--mandys-border)] p-4 text-sm">{c.rejected}</p>;
  if (!invitation) return <p role="alert" className="rounded-xl border border-[var(--mandys-danger)]/30 p-4 text-sm text-[var(--mandys-danger)]">{error ?? c.invalid}</p>;

  const role = Array.isArray(invitation.role) ? invitation.role.join(", ") : invitation.role;
  const organizationName = invitation.organization?.name ?? invitation.organizationId;
  return <div className="space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mandys-accent)]">{c.title}</p><h1 className="mt-2 text-2xl font-semibold">{c.invited} {organizationName}</h1></div>
    <dl className="grid gap-3 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4 sm:grid-cols-2"><div><dt className="text-xs text-[var(--mandys-foreground-muted)]">{c.role}</dt><dd className="mt-1 font-medium">{role}</dd></div><div><dt className="text-xs text-[var(--mandys-foreground-muted)]">{c.expires}</dt><dd className="mt-1 font-medium">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expiresAt))}</dd></div></dl>
    {error ? <p role="alert" className="text-sm text-[var(--mandys-danger)]">{error}</p> : null}
    <div className="flex flex-wrap gap-3"><Button onClick={() => void accept()} disabled={busy}>{busy ? c.accepting : c.accept}</Button><Button variant="secondary" onClick={() => void reject()} disabled={busy}>{c.reject}</Button></div>
  </div>;
}
