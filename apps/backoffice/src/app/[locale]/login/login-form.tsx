"use client";

import type { Locale } from "@mandys/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";

const copy = {
  "pt-PT": {
    signIn: "Entrar",
    create: "Criar conta",
    recover: "Recuperar palavra-passe",
    name: "Nome",
    email: "Email",
    password: "Palavra-passe",
    submitSignIn: "Entrar no Mandy's",
    submitCreate: "Criar conta e continuar",
    submitRecover: "Enviar link de recuperação",
    forgotPassword: "Esqueceu-se da palavra-passe?",
    switchToCreate: "Ainda não tem conta? Criar conta",
    switchToSignIn: "Já tem conta? Entrar",
    recoverHelp: "Introduza o seu email. Se existir uma conta, enviaremos um link seguro para definir uma nova palavra-passe.",
    recoverSent: "Se existir uma conta com este email, receberá um link de recuperação. Verifique também a pasta de spam.",
    genericError: "Não foi possível concluir o pedido. Tente novamente.",
  },
  "pt-BR": {
    signIn: "Entrar",
    create: "Criar conta",
    recover: "Recuperar senha",
    name: "Nome",
    email: "E-mail",
    password: "Senha",
    submitSignIn: "Entrar no Mandy's",
    submitCreate: "Criar conta e continuar",
    submitRecover: "Enviar link de recuperação",
    forgotPassword: "Esqueceu a senha?",
    switchToCreate: "Ainda não tem conta? Criar conta",
    switchToSignIn: "Já tem conta? Entrar",
    recoverHelp: "Informe seu e-mail. Se existir uma conta, enviaremos um link seguro para definir uma nova senha.",
    recoverSent: "Se existir uma conta com este e-mail, você receberá um link de recuperação. Verifique também a pasta de spam.",
    genericError: "Não foi possível concluir a solicitação. Tente novamente.",
  },
  en: {
    signIn: "Sign in",
    create: "Create account",
    recover: "Recover password",
    name: "Name",
    email: "Email",
    password: "Password",
    submitSignIn: "Sign in to Mandy's",
    submitCreate: "Create account and continue",
    submitRecover: "Send recovery link",
    forgotPassword: "Forgot your password?",
    switchToCreate: "New to Mandy's? Create an account",
    switchToSignIn: "Already have an account? Sign in",
    recoverHelp: "Enter your email. If an account exists, we'll send a secure link to set a new password.",
    recoverSent: "If an account exists for this email, you'll receive a recovery link. Check your spam folder too.",
    genericError: "We couldn't complete the request. Please try again.",
  },
  es: {
    signIn: "Entrar",
    create: "Crear cuenta",
    recover: "Recuperar contraseña",
    name: "Nombre",
    email: "Correo electrónico",
    password: "Contraseña",
    submitSignIn: "Entrar en Mandy's",
    submitCreate: "Crear cuenta y continuar",
    submitRecover: "Enviar enlace de recuperación",
    forgotPassword: "¿Olvidaste la contraseña?",
    switchToCreate: "¿Aún no tienes cuenta? Crear cuenta",
    switchToSignIn: "¿Ya tienes cuenta? Entrar",
    recoverHelp: "Introduce tu correo. Si existe una cuenta, enviaremos un enlace seguro para definir una nueva contraseña.",
    recoverSent: "Si existe una cuenta con este correo, recibirás un enlace de recuperación. Revisa también la carpeta de spam.",
    genericError: "No se pudo completar la solicitud. Inténtalo de nuevo.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

type Mode = "sign-in" | "sign-up" | "recover";

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const c = copy[locale];

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    try {
      if (mode === "recover") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/${locale}/reset-password`,
        });
        if (result.error) {
          setError(c.genericError);
          return;
        }
        setNotice(c.recoverSent);
        return;
      }

      if (mode === "sign-up") {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) {
          setError(result.error.message ?? c.genericError);
          return;
        }
        router.push(`/${locale}/onboarding`);
        router.refresh();
        return;
      }

      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? c.genericError);
        return;
      }

      const organizations = await authClient.organization.list();
      const firstOrganization = organizations.data?.[0];
      if (firstOrganization) {
        await authClient.organization.setActive({ organizationId: firstOrganization.id });
        router.push(`/${locale}`);
      } else {
        router.push(`/${locale}/onboarding`);
      }
      router.refresh();
    } catch {
      setError(c.genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={onSubmit}>
      {mode === "recover" ? (
        <div className="rounded-xl border border-[var(--mandys-border)] bg-[var(--mandys-surface-subtle)] px-3.5 py-3 text-sm leading-6 text-[var(--mandys-foreground-muted)]">
          <p className="font-medium text-[var(--mandys-foreground)]">{c.recover}</p>
          <p className="mt-1">{c.recoverHelp}</p>
        </div>
      ) : null}

      {mode === "sign-up" ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{c.name}</span>
          <input name="name" autoComplete="name" required minLength={2} maxLength={120} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{c.email}</span>
        <input name="email" type="email" autoComplete="email" required className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
      </label>

      {mode !== "recover" ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{c.password}</span>
          <input name="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={8} maxLength={128} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>
      ) : null}

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-[var(--mandys-border)] px-3 py-2 text-sm text-[var(--mandys-foreground-muted)]">{notice}</p> : null}

      <button type="submit" disabled={pending} className="w-full rounded-xl bg-[var(--mandys-foreground)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "…" : mode === "sign-up" ? c.submitCreate : mode === "recover" ? c.submitRecover : c.submitSignIn}
      </button>

      {mode === "sign-in" ? (
        <button type="button" onClick={() => changeMode("recover")} className="w-full text-center text-sm text-[var(--mandys-foreground-muted)] underline-offset-4 hover:underline">
          {c.forgotPassword}
        </button>
      ) : null}

      <button type="button" onClick={() => changeMode(mode === "sign-in" ? "sign-up" : "sign-in")} className="w-full text-center text-sm text-[var(--mandys-foreground-muted)] underline-offset-4 hover:underline">
        {mode === "sign-in" ? c.switchToCreate : c.switchToSignIn}
      </button>
    </form>
  );
}
