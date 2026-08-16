"use client";

import { locales, localeLabels, type Locale } from "@mandys/i18n";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { authClient } from "../../../lib/auth-client";

const copy = {
  "pt-PT": {
    publicName: "Nome público do restaurante",
    legalName: "Nome legal (opcional)",
    locationName: "Nome da localização",
    slug: "Identificador do restaurante",
    email: "Email",
    phone: "Telefone",
    address: "Morada",
    postalCode: "Código postal",
    city: "Cidade",
    languages: "Idiomas do site",
    submit: "Criar restaurante",
    genericError: "Não foi possível concluir a configuração.",
    slugHelp: "Usado internamente e nas primeiras URLs de demonstração. Pode ser alterado depois.",
  },
  "pt-BR": {
    publicName: "Nome público do restaurante",
    legalName: "Razão social (opcional)",
    locationName: "Nome da unidade",
    slug: "Identificador do restaurante",
    email: "E-mail",
    phone: "Telefone",
    address: "Endereço",
    postalCode: "CEP / código postal",
    city: "Cidade",
    languages: "Idiomas do site",
    submit: "Criar restaurante",
    genericError: "Não foi possível concluir a configuração.",
    slugHelp: "Usado internamente e nas primeiras URLs de demonstração. Pode ser alterado depois.",
  },
  en: {
    publicName: "Restaurant public name",
    legalName: "Legal name (optional)",
    locationName: "Location name",
    slug: "Restaurant identifier",
    email: "Email",
    phone: "Phone",
    address: "Address",
    postalCode: "Postal code",
    city: "City",
    languages: "Website languages",
    submit: "Create restaurant",
    genericError: "We couldn't complete the setup.",
    slugHelp: "Used internally and for the first demo URLs. It can be changed later.",
  },
  es: {
    publicName: "Nombre público del restaurante",
    legalName: "Razón social (opcional)",
    locationName: "Nombre de la ubicación",
    slug: "Identificador del restaurante",
    email: "Correo electrónico",
    phone: "Teléfono",
    address: "Dirección",
    postalCode: "Código postal",
    city: "Ciudad",
    languages: "Idiomas del sitio",
    submit: "Crear restaurante",
    genericError: "No se pudo completar la configuración.",
    slugHelp: "Se usa internamente y en las primeras URL de demostración. Podrás cambiarlo después.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function OnboardingForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const c = copy[locale];
  const [publicName, setPublicName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabledLocales, setEnabledLocales] = useState<Locale[]>(() => {
    const defaults: Locale[] = ["pt-PT", "en", "es"];
    if (locale === "pt-BR" && !defaults.includes("pt-BR")) defaults.push("pt-BR");
    return defaults;
  });

  const defaultLocale = useMemo<Locale>(() => {
    if (enabledLocales.includes(locale)) return locale;
    return enabledLocales[0] ?? "pt-PT";
  }, [enabledLocales, locale]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

    try {
      const session = await authClient.getSession();
      if (!session.data) {
        router.push(`/${locale}/login`);
        return;
      }

      const organizations = await authClient.organization.list();
      let organization = organizations.data?.[0];

      if (!organization) {
        const internalSlug = `mandys-${slug}-${crypto.randomUUID().slice(0, 8)}`;
        const created = await authClient.organization.create({
          name: publicName,
          slug: internalSlug,
        });

        if (created.error || !created.data) {
          setError(created.error?.message ?? c.genericError);
          return;
        }

        organization = created.data;
      }

      const active = await authClient.organization.setActive({
        organizationId: organization.id,
      });

      if (active.error) {
        setError(active.error.message ?? c.genericError);
        return;
      }

      const response = await fetch(`${apiUrl}/v1/onboarding/restaurant`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          publicName,
          legalName: String(form.get("legalName") ?? "").trim() || undefined,
          locationName: String(form.get("locationName") ?? "").trim(),
          slug,
          email: String(form.get("email") ?? "").trim() || undefined,
          phone: String(form.get("phone") ?? "").trim() || undefined,
          addressLine1: String(form.get("addressLine1") ?? "").trim() || undefined,
          postalCode: String(form.get("postalCode") ?? "").trim() || undefined,
          city: String(form.get("city") ?? "").trim() || undefined,
          countryCode: "PT",
          timezone: "Europe/Lisbon",
          currency: "EUR",
          defaultLocale,
          enabledLocales,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(payload?.message ?? c.genericError);
        return;
      }

      router.push(`/${locale}`);
      router.refresh();
    } catch {
      setError(c.genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)] sm:p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">{c.publicName}</span>
          <input
            value={publicName}
            onChange={(event) => {
              const next = event.target.value;
              setPublicName(next);
              if (!slugTouched) setSlug(normalizeSlug(next));
            }}
            required
            minLength={2}
            maxLength={160}
            className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium">{c.legalName}</span>
          <input name="legalName" maxLength={200} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium">{c.locationName}</span>
          <input name="locationName" defaultValue="Principal" required minLength={2} maxLength={160} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">{c.slug}</span>
          <input
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(normalizeSlug(event.target.value));
            }}
            required
            minLength={2}
            maxLength={80}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 font-mono text-sm outline-none transition focus:border-[var(--mandys-accent)]"
          />
          <span className="mt-1.5 block text-xs text-[var(--mandys-foreground-muted)]">{c.slugHelp}</span>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium">{c.email}</span>
          <input name="email" type="email" autoComplete="email" className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium">{c.phone}</span>
          <input name="phone" type="tel" autoComplete="tel" maxLength={40} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">{c.address}</span>
          <input name="addressLine1" autoComplete="street-address" maxLength={200} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium">{c.postalCode}</span>
          <input name="postalCode" autoComplete="postal-code" maxLength={24} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-medium">{c.city}</span>
          <input name="city" autoComplete="address-level2" maxLength={120} className="w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]" />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">{c.languages}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {locales.map((item) => {
            const checked = enabledLocales.includes(item);
            return (
              <label key={item} className="flex items-center gap-3 rounded-xl border border-[var(--mandys-border)] px-3.5 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    setEnabledLocales((current) => {
                      if (event.target.checked) return [...new Set([...current, item])];
                      if (current.length === 1) return current;
                      return current.filter((localeItem) => localeItem !== item);
                    });
                  }}
                />
                <span>{localeLabels[item]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !slug || enabledLocales.length === 0}
        className="w-full rounded-xl bg-[var(--mandys-foreground)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "…" : c.submit}
      </button>
    </form>
  );
}
