"use client";

import { Button, Surface, useToast } from "@mandys/ui";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { type PasswordValidationCode, validatePasswordChange } from "./password-utils";

const copy = {
  "pt-PT": {
    title: "Alterar password",
    subtitle: "Confirme a password atual e escolha uma nova. As outras sessões serão terminadas por segurança.",
    current: "Password atual",
    next: "Nova password",
    confirm: "Confirmar nova password",
    save: "Alterar password",
    saving: "A alterar…",
    saved: "Password alterada com sucesso.",
    changeError: "Não foi possível alterar a password. Confirme a password atual e tente novamente.",
    contextError: "A password foi alterada, mas não foi possível restaurar o restaurante ativo. Atualize a página antes de continuar.",
    currentRequired: "Indique a password atual.",
    length: "A nova password deve ter entre 8 e 128 caracteres.",
    reused: "Escolha uma password diferente da atual.",
    mismatch: "As novas passwords não coincidem.",
  },
  "pt-BR": {
    title: "Alterar senha",
    subtitle: "Confirme a senha atual e escolha uma nova. As outras sessões serão encerradas por segurança.",
    current: "Senha atual",
    next: "Nova senha",
    confirm: "Confirmar nova senha",
    save: "Alterar senha",
    saving: "Alterando…",
    saved: "Senha alterada com sucesso.",
    changeError: "Não foi possível alterar a senha. Confirme a senha atual e tente novamente.",
    contextError: "A senha foi alterada, mas não foi possível restaurar o restaurante ativo. Atualize a página antes de continuar.",
    currentRequired: "Informe a senha atual.",
    length: "A nova senha deve ter entre 8 e 128 caracteres.",
    reused: "Escolha uma senha diferente da atual.",
    mismatch: "As novas senhas não coincidem.",
  },
  en: {
    title: "Change password",
    subtitle: "Confirm your current password and choose a new one. Other sessions will be signed out for security.",
    current: "Current password",
    next: "New password",
    confirm: "Confirm new password",
    save: "Change password",
    saving: "Changing…",
    saved: "Password changed successfully.",
    changeError: "We couldn't change the password. Check your current password and try again.",
    contextError: "Your password changed, but the active restaurant could not be restored. Refresh the page before continuing.",
    currentRequired: "Enter your current password.",
    length: "The new password must be between 8 and 128 characters.",
    reused: "Choose a password different from your current one.",
    mismatch: "The new passwords do not match.",
  },
  es: {
    title: "Cambiar contraseña",
    subtitle: "Confirma tu contraseña actual y elige una nueva. Las demás sesiones se cerrarán por seguridad.",
    current: "Contraseña actual",
    next: "Nueva contraseña",
    confirm: "Confirmar nueva contraseña",
    save: "Cambiar contraseña",
    saving: "Cambiando…",
    saved: "Contraseña cambiada correctamente.",
    changeError: "No se pudo cambiar la contraseña. Comprueba la contraseña actual e inténtalo de nuevo.",
    contextError: "La contraseña cambió, pero no se pudo restaurar el restaurante activo. Actualiza la página antes de continuar.",
    currentRequired: "Indica la contraseña actual.",
    length: "La nueva contraseña debe tener entre 8 y 128 caracteres.",
    reused: "Elige una contraseña diferente de la actual.",
    mismatch: "Las nuevas contraseñas no coinciden.",
  },
} as const;

type SupportedLocale = keyof typeof copy;

function validationMessage(locale: SupportedLocale, code: PasswordValidationCode) {
  const c = copy[locale];
  if (code === "CURRENT_REQUIRED") return c.currentRequired;
  if (code === "NEW_LENGTH") return c.length;
  if (code === "PASSWORD_REUSED") return c.reused;
  return c.mismatch;
}

export function PasswordChange({ locale }: { locale: SupportedLocale }) {
  const c = copy[locale];
  const toast = useToast();
  const activeOrganization = authClient.useActiveOrganization();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const validation = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
    if (!validation.ok) {
      setError(validationMessage(locale, validation.code));
      return;
    }

    const activeOrganizationId = activeOrganization.data?.id ?? null;
    setError(null);
    setSaving(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        toast.error(c.changeError);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (activeOrganizationId) {
        const restored = await authClient.organization.setActive({
          organizationId: activeOrganizationId,
        });
        if (restored.error) {
          toast.error(c.contextError);
          return;
        }
      }

      toast.success(c.saved);
    } catch {
      toast.error(c.changeError);
    } finally {
      setSaving(false);
    }
  }

  const fieldClassName =
    "min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-background)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mandys-accent)]";

  return (
    <Surface className="max-w-2xl p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.03em]">{c.title}</h2>
        <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.subtitle}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium">{c.current}</label>
          <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); if (error) setError(null); }} className={fieldClassName} />
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">{c.next}</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); if (error) setError(null); }} className={fieldClassName} />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">{c.confirm}</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); if (error) setError(null); }} aria-invalid={Boolean(error)} aria-describedby={error ? "password-change-error" : undefined} className={fieldClassName} />
        </div>
        {error ? <p id="password-change-error" role="alert" className="text-sm text-[var(--mandys-danger)]">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} aria-busy={saving}>{saving ? c.saving : c.save}</Button>
        </div>
      </form>
    </Surface>
  );
}
