"use client";

import type { Locale } from "@mandys/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { validatePasswordReset } from "./password-recovery-utils";

const copy = {
  "pt-PT": {
    password: "Nova palavra-passe",
    confirm: "Confirmar nova palavra-passe",
    submit: "Definir nova palavra-passe",
    invalid: "Este link de recuperação é inválido ou expirou. Peça um novo link no ecrã de entrada.",
    length: "A palavra-passe deve ter entre 8 e 128 caracteres.",
    mismatch: "As palavras-passe não coincidem.",
    generic: "Não foi possível alterar a palavra-passe. Peça um novo link e tente novamente.",
    success: "Palavra-passe alterada. Já pode entrar com a nova palavra-passe.",
    signIn: "Voltar para entrar",
  },
  "pt-BR": {
    password: "Nova senha",
    confirm: "Confirmar nova senha",
    submit: "Definir nova senha",
    invalid: "Este link de recuperação é inválido ou expirou. Solicite um novo link na tela de entrada.",
    length: "A senha deve ter entre 8 e 128 caracteres.",
    mismatch: "As senhas não coincidem.",
    generic: "Não foi possível alterar a senha. Solicite um novo link e tente novamente.",
    success: "Senha alterada. Você já pode entrar com a nova senha.",
    signIn: "Voltar para entrar",
  },
  en: {
    password: "New password",
    confirm: "Confirm new password",
    submit: "Set new password",
    invalid: "This recovery link is invalid or expired. Request a new link from the sign-in screen.",
    length: "Your password must be between 8 and 128 characters.",
    mismatch: "The passwords do not match.",
    generic: "We couldn't reset your password. Request a new link and try again.",
    success: "Password changed. You can now sign in with your new password.",
    signIn: "Back to sign in",
  },
  es: {
    password: "Nueva contraseña",
    confirm: "Confirmar nueva contraseña",
    submit: "Definir nueva contraseña",
    invalid: "Este enlace de recuperación no es válido o ha caducado. Solicita uno nuevo desde la pantalla de acceso.",
    length: "La contraseña debe tener entre 8 y 128 caracteres.",
    mismatch: "Las contraseñas no coinciden.",
    generic: "No se pudo restablecer la contraseña. Solicita un nuevo enlace e inténtalo de nuevo.",
    success: "Contraseña actualizada. Ya puedes entrar con la nueva contraseña.",
    signIn: "Volver a entrar",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const upstreamError = searchParams.get("error");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(upstreamError || !token ? copy[locale].invalid : null);
  const [success, setSuccess] = useState(false);
  const c = copy[locale];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const validation = validatePasswordReset({ token, newPassword, confirmPassword });

    if (!validation.ok) {
      setPending(false);
      setError(validation.code === "NEW_LENGTH" ? c.length : validation.code === "CONFIRM_MISMATCH" ? c.mismatch : c.invalid);
      return;
    }

    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError(c.generic);
        return;
      }
      setSuccess(true);
    } catch {
      setError(c.generic);
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="mt-8 space-y-4">
        <p role="status" className="rounded-xl border border-[var(--mandys-border)] px-3.5 py-3 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.success}</p>
        <button type="button" onClick={() => router.replace(`/${locale}/login`)} className="w-full rounded-xl bg-[var(--mandys-foreground)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90">{c.signIn}</button>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={onSubmit}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{c.password}</span>
        <input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={!token || Boolean(upstreamError)} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)] disabled:opacity-60" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{c.confirm}</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={!token || Boolean(upstreamError)} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)] disabled:opacity-60" />
      </label>
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={pending || !token || Boolean(upstreamError)} className="w-full rounded-xl bg-[var(--mandys-foreground)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "…" : c.submit}</button>
      <button type="button" onClick={() => router.replace(`/${locale}/login`)} className="w-full text-center text-sm text-[var(--mandys-foreground-muted)] underline-offset-4 hover:underline">{c.signIn}</button>
    </form>
  );
}
