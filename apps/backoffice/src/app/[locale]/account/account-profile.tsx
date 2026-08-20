"use client";

import { Button, ErrorState, LoadingState, Surface, useToast } from "@mandys/ui";
import { useEffect, useMemo, useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { normalizeProfileName, validateProfileName } from "./profile-utils";

const copy = {
  "pt-PT": { loading: "A carregar o seu perfil…", loadError: "Não foi possível carregar o seu perfil.", retry: "Tentar novamente", name: "Nome", email: "Email", verified: "Email verificado", unverified: "Email ainda não verificado", save: "Guardar alterações", saving: "A guardar…", saved: "Perfil atualizado.", saveError: "Não foi possível atualizar o perfil.", invalidName: "Indique um nome entre 1 e 100 caracteres.", emailHint: "A alteração de email será disponibilizada numa área de segurança própria.", avatarAlt: "Avatar do utilizador" },
  "pt-BR": { loading: "Carregando seu perfil…", loadError: "Não foi possível carregar seu perfil.", retry: "Tentar novamente", name: "Nome", email: "Email", verified: "Email verificado", unverified: "Email ainda não verificado", save: "Salvar alterações", saving: "Salvando…", saved: "Perfil atualizado.", saveError: "Não foi possível atualizar o perfil.", invalidName: "Informe um nome entre 1 e 100 caracteres.", emailHint: "A alteração de email será disponibilizada em uma área de segurança própria.", avatarAlt: "Avatar do usuário" },
  en: { loading: "Loading your profile…", loadError: "We couldn't load your profile.", retry: "Try again", name: "Name", email: "Email", verified: "Email verified", unverified: "Email not verified yet", save: "Save changes", saving: "Saving…", saved: "Profile updated.", saveError: "We couldn't update the profile.", invalidName: "Enter a name between 1 and 100 characters.", emailHint: "Email changes will be available in a dedicated security area.", avatarAlt: "User avatar" },
  es: { loading: "Cargando tu perfil…", loadError: "No se pudo cargar tu perfil.", retry: "Intentar de nuevo", name: "Nombre", email: "Email", verified: "Email verificado", unverified: "Email aún no verificado", save: "Guardar cambios", saving: "Guardando…", saved: "Perfil actualizado.", saveError: "No se pudo actualizar el perfil.", invalidName: "Indica un nombre de entre 1 y 100 caracteres.", emailHint: "El cambio de email estará disponible en un área de seguridad específica.", avatarAlt: "Avatar del usuario" },
} as const;

type SupportedLocale = keyof typeof copy;

export function AccountProfile({ locale }: { locale: SupportedLocale }) {
  const c = copy[locale];
  const toast = useToast();
  const session = authClient.useSession();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const user = session.data?.user;
  const normalizedInitialName = useMemo(() => normalizeProfileName(user?.name ?? ""), [user?.name]);

  useEffect(() => { if (user) setName(user.name ?? ""); }, [user]);

  if (session.isPending) return <LoadingState label={c.loading} rows={3} />;
  if (session.error || !user) return <ErrorState title={c.loadError} description={c.loadError} retryLabel={c.retry} onRetry={() => void session.refetch()} />;

  const normalizedName = normalizeProfileName(name);
  const unchanged = normalizedName === normalizedInitialName;

  async function saveProfile() {
    const validation = validateProfileName(name);
    if (!validation.ok) { setValidationError(c.invalidName); return; }
    setValidationError(null); setSaving(true);
    try {
      const result = await authClient.updateUser({ name: validation.value });
      if (result.error) { toast.error(result.error.message || c.saveError); return; }
      setName(validation.value);
      await session.refetch();
      toast.success(c.saved);
    } catch { toast.error(c.saveError); } finally { setSaving(false); }
  }

  const initials = normalizedName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";

  return (
    <Surface className="max-w-2xl p-5 sm:p-6">
      <div className="mb-6 flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Better Auth accepts remote profile images from multiple providers.
          <img src={user.image} alt={c.avatarAlt} className="h-16 w-16 rounded-full border border-[var(--mandys-border)] object-cover" />
        ) : (
          <div aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full bg-[var(--mandys-surface-muted)] text-lg font-semibold">{initials}</div>
        )}
        <div className="min-w-0"><p className="truncate font-semibold">{normalizedInitialName}</p><p className="truncate text-sm text-[var(--mandys-foreground-muted)]">{user.email}</p></div>
      </div>

      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
        <div>
          <label htmlFor="account-name" className="mb-1.5 block text-sm font-medium">{c.name}</label>
          <input id="account-name" name="name" autoComplete="name" maxLength={101} value={name} onChange={(event) => { setName(event.target.value); if (validationError) setValidationError(null); }} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? "account-name-error" : undefined} className="min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-background)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mandys-accent)]" />
          {validationError ? <p id="account-name-error" role="alert" className="mt-1.5 text-sm text-[var(--mandys-danger)]">{validationError}</p> : null}
        </div>

        <div>
          <label htmlFor="account-email" className="mb-1.5 block text-sm font-medium">{c.email}</label>
          <input id="account-email" value={user.email} readOnly aria-readonly="true" className="min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-surface-muted)] px-3 py-2 text-sm text-[var(--mandys-foreground-muted)]" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--mandys-foreground-muted)]"><span className="rounded-full border border-[var(--mandys-border)] px-2 py-1">{user.emailVerified ? c.verified : c.unverified}</span><span>{c.emailHint}</span></div>
        </div>

        <div className="flex justify-end"><Button type="submit" disabled={saving || unchanged} aria-busy={saving}>{saving ? c.saving : c.save}</Button></div>
      </form>
    </Surface>
  );
}
