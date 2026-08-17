"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "../../../lib/auth-client";

const assignableRoles = ["manager", "reception", "kitchen", "staff", "marketing", "accounting"] as const;
type AssignableRole = (typeof assignableRoles)[number];

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  createdAt: string | Date;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
};

type OrganizationView = {
  id: string;
  name: string;
  members?: MemberRow[];
};

const copy = {
  "pt-PT": {
    members: "Membros", membersHelp: "As funções controlam o acesso de cada pessoa dentro deste restaurante.", invite: "Convidar pessoa", inviteHelp: "Adicione alguém à equipa com a função adequada.", email: "Email", role: "Função", send: "Criar convite", sending: "A criar…", pending: "Convites pendentes", noPending: "Não existem convites pendentes.", cancel: "Cancelar convite", remove: "Remover", update: "Alterar função", loading: "A carregar equipa…", retry: "Atualizar", inviteCreated: "Convite criado. O envio por email será ligado ao serviço de notificações.", updated: "Função atualizada.", removed: "Membro removido.", cancelled: "Convite cancelado.", genericError: "Não foi possível concluir a operação.", you: "Você", ownerLocked: "O proprietário principal não é alterado aqui.", owner: "Proprietário", manager: "Gestor", reception: "Receção", kitchen: "Cozinha", staff: "Equipa", marketing: "Marketing", accounting: "Contabilidade",
  },
  "pt-BR": {
    members: "Membros", membersHelp: "As funções controlam o acesso de cada pessoa dentro deste restaurante.", invite: "Convidar pessoa", inviteHelp: "Adicione alguém à equipe com a função adequada.", email: "E-mail", role: "Função", send: "Criar convite", sending: "Criando…", pending: "Convites pendentes", noPending: "Não há convites pendentes.", cancel: "Cancelar convite", remove: "Remover", update: "Alterar função", loading: "Carregando equipe…", retry: "Atualizar", inviteCreated: "Convite criado. O envio por e-mail será ligado ao serviço de notificações.", updated: "Função atualizada.", removed: "Membro removido.", cancelled: "Convite cancelado.", genericError: "Não foi possível concluir a operação.", you: "Você", ownerLocked: "O proprietário principal não é alterado aqui.", owner: "Proprietário", manager: "Gestor", reception: "Recepção", kitchen: "Cozinha", staff: "Equipe", marketing: "Marketing", accounting: "Contabilidade",
  },
  en: {
    members: "Members", membersHelp: "Roles control what each person can access inside this restaurant.", invite: "Invite person", inviteHelp: "Add someone to the team with the appropriate role.", email: "Email", role: "Role", send: "Create invitation", sending: "Creating…", pending: "Pending invitations", noPending: "There are no pending invitations.", cancel: "Cancel invitation", remove: "Remove", update: "Change role", loading: "Loading team…", retry: "Refresh", inviteCreated: "Invitation created. Email delivery will be connected to the notification service.", updated: "Role updated.", removed: "Member removed.", cancelled: "Invitation cancelled.", genericError: "The operation could not be completed.", you: "You", ownerLocked: "The primary owner is not changed here.", owner: "Owner", manager: "Manager", reception: "Reception", kitchen: "Kitchen", staff: "Staff", marketing: "Marketing", accounting: "Accounting",
  },
  es: {
    members: "Miembros", membersHelp: "Los roles controlan el acceso de cada persona dentro del restaurante.", invite: "Invitar persona", inviteHelp: "Añade a alguien al equipo con el rol adecuado.", email: "Email", role: "Rol", send: "Crear invitación", sending: "Creando…", pending: "Invitaciones pendientes", noPending: "No hay invitaciones pendientes.", cancel: "Cancelar invitación", remove: "Eliminar", update: "Cambiar rol", loading: "Cargando equipo…", retry: "Actualizar", inviteCreated: "Invitación creada. El envío por email se conectará al servicio de notificaciones.", updated: "Rol actualizado.", removed: "Miembro eliminado.", cancelled: "Invitación cancelada.", genericError: "No se pudo completar la operación.", you: "Tú", ownerLocked: "El propietario principal no se modifica aquí.", owner: "Propietario", manager: "Gestor", reception: "Recepción", kitchen: "Cocina", staff: "Equipo", marketing: "Marketing", accounting: "Contabilidad",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const fieldClassName = "min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

function messageOf(error: { message?: string | undefined } | null | undefined, fallback: string): string {
  return error?.message ?? fallback;
}

export function TeamBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [organization, setOrganization] = useState<OrganizationView | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const roleLabel = useCallback((role: string) => {
    const labels: Record<string, string> = { owner: c.owner, manager: c.manager, reception: c.reception, kitchen: c.kitchen, staff: c.staff, marketing: c.marketing, accounting: c.accounting };
    return labels[role] ?? role;
  }, [c]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResult, organizationResult] = await Promise.all([
        authClient.getSession(),
        authClient.organization.getFullOrganization({ query: { membersLimit: 100 } }),
      ]);
      if (sessionResult.error) throw new Error(messageOf(sessionResult.error, c.genericError));
      if (organizationResult.error) throw new Error(messageOf(organizationResult.error, c.genericError));
      if (!organizationResult.data) throw new Error(c.genericError);

      const org = organizationResult.data as OrganizationView;
      setOrganization(org);
      setMembers(Array.isArray(org.members) ? org.members : []);
      setCurrentUserId(sessionResult.data?.user.id ?? null);

      const invitationResult = await authClient.organization.listInvitations({ query: { organizationId: org.id } });
      if (invitationResult.error) throw new Error(messageOf(invitationResult.error, c.genericError));
      const rows = invitationResult.data as unknown;
      setInvitations(Array.isArray(rows) ? (rows as InvitationRow[]).filter((row) => row.status === "pending") : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : c.genericError);
    } finally {
      setLoading(false);
    }
  }, [c.genericError]);

  useEffect(() => { void load(); }, [load]);

  async function inviteMember(formData: FormData) {
    if (!organization) return;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "staff") as AssignableRole;
    setInviting(true); setError(null); setNotice(null);
    try {
      const result = await authClient.organization.inviteMember({ email, role, organizationId: organization.id });
      if (result.error) throw new Error(messageOf(result.error, c.genericError));
      setNotice(c.inviteCreated);
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : c.genericError);
    } finally { setInviting(false); }
  }

  async function updateRole(member: MemberRow, role: AssignableRole) {
    if (!organization || member.role === "owner") return;
    setBusyId(member.id); setError(null); setNotice(null);
    try {
      const result = await authClient.organization.updateMemberRole({ memberId: member.id, role, organizationId: organization.id });
      if (result.error) throw new Error(messageOf(result.error, c.genericError));
      setNotice(c.updated);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : c.genericError);
    } finally { setBusyId(null); }
  }

  async function removeMember(member: MemberRow) {
    if (!organization || member.role === "owner" || member.userId === currentUserId) return;
    setBusyId(member.id); setError(null); setNotice(null);
    try {
      const result = await authClient.organization.removeMember({ memberIdOrEmail: member.id, organizationId: organization.id });
      if (result.error) throw new Error(messageOf(result.error, c.genericError));
      setNotice(c.removed);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : c.genericError);
    } finally { setBusyId(null); }
  }

  async function cancelInvitation(invitationId: string) {
    setBusyId(invitationId); setError(null); setNotice(null);
    try {
      const result = await authClient.organization.cancelInvitation({ invitationId });
      if (result.error) throw new Error(messageOf(result.error, c.genericError));
      setNotice(c.cancelled);
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : c.genericError);
    } finally { setBusyId(null); }
  }

  if (loading && !organization) return <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div>;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="h-fit rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
        <h2 className="text-lg font-semibold">{c.invite}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.inviteHelp}</p>
        <form action={inviteMember} className="mt-5 space-y-4">
          <label className="block text-sm font-medium"><span className="mb-1.5 block">{c.email}</span><input name="email" type="email" required autoComplete="email" className={fieldClassName} /></label>
          <label className="block text-sm font-medium"><span className="mb-1.5 block">{c.role}</span><select name="role" defaultValue="staff" className={fieldClassName}>{assignableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <Button type="submit" className="w-full" disabled={inviting || !organization}>{inviting ? c.sending : c.send}</Button>
        </form>
        <div className="mt-8 border-t border-[var(--mandys-border)] pt-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{c.pending}</h3><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{c.retry}</Button></div>
          {invitations.length === 0 ? <p className="mt-3 text-sm text-[var(--mandys-foreground-muted)]">{c.noPending}</p> : <div className="mt-3 space-y-3">{invitations.map((invitation) => <article key={invitation.id} className="rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] p-3"><p className="truncate text-sm font-medium">{invitation.email}</p><p className="mt-1 text-xs text-[var(--mandys-foreground-muted)]">{roleLabel(invitation.role)} · {dateFormatter.format(new Date(invitation.expiresAt))}</p><button type="button" disabled={busyId === invitation.id} onClick={() => void cancelInvitation(invitation.id)} className="mt-2 text-xs font-medium text-[var(--mandys-danger)] disabled:opacity-50">{c.cancel}</button></article>)}</div>}
        </div>
      </aside>

      <section className="min-w-0">
        <div className="mb-4"><h2 className="text-lg font-semibold">{c.members}</h2><p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.membersHelp}</p></div>
        {error ? <div className="mb-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-danger)]/30 p-4 text-sm text-[var(--mandys-danger)]">{error}</div> : null}
        {notice ? <div className="mb-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4 text-sm">{notice}</div> : null}
        <div className="space-y-3">{members.map((member) => {
          const isOwner = member.role === "owner";
          const isSelf = member.userId === currentUserId;
          return <article key={member.id} className="grid gap-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 md:grid-cols-[1fr_220px_auto] md:items-center"><div className="min-w-0"><p className="truncate font-medium">{member.user?.name || member.user?.email || member.userId}</p><p className="truncate text-sm text-[var(--mandys-foreground-muted)]">{member.user?.email}{isSelf ? ` · ${c.you}` : ""}</p></div>{isOwner ? <div className="text-sm"><strong>{c.owner}</strong><p className="text-xs text-[var(--mandys-foreground-muted)]">{c.ownerLocked}</p></div> : <select aria-label={c.role} value={assignableRoles.includes(member.role as AssignableRole) ? member.role : "staff"} disabled={busyId === member.id} onChange={(event) => void updateRole(member, event.target.value as AssignableRole)} className={fieldClassName}>{assignableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select>}<div className="flex justify-end">{!isOwner && !isSelf ? <Button variant="secondary" size="sm" disabled={busyId === member.id} onClick={() => void removeMember(member)}>{c.remove}</Button> : null}</div></article>;
        })}</div>
      </section>
    </div>
  );
}
