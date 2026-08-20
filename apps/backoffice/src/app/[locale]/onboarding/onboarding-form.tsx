"use client";

import { localeLabels, locales, type Locale } from "@mandys/i18n";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { getOnboardingChecklist, onboardingCompletionPercent, type OnboardingChecklistKey } from "./onboarding-progress";

type RegionDefaults = { countryCode: string; timezone: string; currency: string };

const defaults: Record<Locale, RegionDefaults> = {
  "pt-PT": { countryCode: "PT", timezone: "Europe/Lisbon", currency: "EUR" },
  "pt-BR": { countryCode: "BR", timezone: "America/Sao_Paulo", currency: "BRL" },
  en: { countryCode: "US", timezone: "America/New_York", currency: "USD" },
  es: { countryCode: "ES", timezone: "Europe/Madrid", currency: "EUR" },
};

const copy = {
  "pt-PT": { publicName: "Nome público do restaurante", legalName: "Nome legal (opcional)", locationName: "Nome da localização", slug: "Identificador do restaurante", email: "Email", phone: "Telefone", address: "Morada", postalCode: "Código postal", city: "Cidade", country: "País (ISO 2)", timezone: "Fuso horário", currency: "Moeda (ISO 3)", languages: "Idiomas do site", submit: "Criar restaurante", genericError: "Não foi possível concluir a configuração.", slugHelp: "Usado internamente e nas primeiras URLs de demonstração. Pode ser alterado depois.", checklistTitle: "Checklist de configuração", checklistHelp: "Complete os quatro blocos essenciais antes de criar o restaurante.", completed: "concluído", identityStep: "Identidade", locationStep: "Localização", regionalStep: "Região e moeda", languagesStep: "Idiomas" },
  "pt-BR": { publicName: "Nome público do restaurante", legalName: "Razão social (opcional)", locationName: "Nome da unidade", slug: "Identificador do restaurante", email: "E-mail", phone: "Telefone", address: "Endereço", postalCode: "CEP / código postal", city: "Cidade", country: "País (ISO 2)", timezone: "Fuso horário", currency: "Moeda (ISO 3)", languages: "Idiomas do site", submit: "Criar restaurante", genericError: "Não foi possível concluir a configuração.", slugHelp: "Usado internamente e nas primeiras URLs de demonstração. Pode ser alterado depois.", checklistTitle: "Checklist de configuração", checklistHelp: "Complete os quatro blocos essenciais antes de criar o restaurante.", completed: "concluído", identityStep: "Identidade", locationStep: "Unidade", regionalStep: "Região e moeda", languagesStep: "Idiomas" },
  en: { publicName: "Restaurant public name", legalName: "Legal name (optional)", locationName: "Location name", slug: "Restaurant identifier", email: "Email", phone: "Phone", address: "Address", postalCode: "Postal code", city: "City", country: "Country (ISO 2)", timezone: "Timezone", currency: "Currency (ISO 3)", languages: "Website languages", submit: "Create restaurant", genericError: "We couldn't complete the setup.", slugHelp: "Used internally and for the first demo URLs. It can be changed later.", checklistTitle: "Setup checklist", checklistHelp: "Complete the four essential setup blocks before creating the restaurant.", completed: "complete", identityStep: "Identity", locationStep: "Location", regionalStep: "Region and currency", languagesStep: "Languages" },
  es: { publicName: "Nombre público del restaurante", legalName: "Razón social (opcional)", locationName: "Nombre de la ubicación", slug: "Identificador del restaurante", email: "Correo electrónico", phone: "Teléfono", address: "Dirección", postalCode: "Código postal", city: "Ciudad", country: "País (ISO 2)", timezone: "Zona horaria", currency: "Moneda (ISO 3)", languages: "Idiomas del sitio", submit: "Crear restaurante", genericError: "No se pudo completar la configuración.", slugHelp: "Se usa internamente y en las primeras URL de demostración. Podrás cambiarlo después.", checklistTitle: "Checklist de configuración", checklistHelp: "Completa los cuatro bloques esenciales antes de crear el restaurante.", completed: "completado", identityStep: "Identidad", locationStep: "Ubicación", regionalStep: "Región y moneda", languagesStep: "Idiomas" },
} as const satisfies Record<Locale, Record<string, string>>;

const inputClass = "w-full rounded-xl border border-[var(--mandys-border)] bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-[var(--mandys-accent)]";

function normalizeSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function OnboardingForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const c = copy[locale];
  const regional = defaults[locale];
  const [publicName, setPublicName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [locationName, setLocationName] = useState("Principal");
  const [countryCode, setCountryCode] = useState(regional.countryCode);
  const [timezone, setTimezone] = useState(regional.timezone);
  const [currency, setCurrency] = useState(regional.currency);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabledLocales, setEnabledLocales] = useState<Locale[]>(() => {
    const initial: Locale[] = locale === "pt-BR" ? ["pt-BR", "en", "es"] : [locale, "en", "es"];
    return [...new Set(initial)];
  });

  const defaultLocale = useMemo<Locale>(() => enabledLocales.includes(locale) ? locale : (enabledLocales[0] ?? "pt-PT"), [enabledLocales, locale]);
  const checklist = useMemo(() => getOnboardingChecklist({ publicName, slug, locationName, countryCode, timezone, currency, defaultLocale, enabledLocales }), [countryCode, currency, defaultLocale, enabledLocales, locationName, publicName, slug, timezone]);
  const completion = onboardingCompletionPercent(checklist);
  const stepLabels: Record<OnboardingChecklistKey, string> = { identity: c.identityStep, location: c.locationStep, regional: c.regionalStep, languages: c.languagesStep };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const session = await authClient.getSession();
      if (!session.data) { router.push(`/${locale}/login`); return; }

      const organizations = await authClient.organization.list();
      let organization = organizations.data?.[0];
      if (!organization) {
        const internalSlug = `mandys-${slug}-${crypto.randomUUID().slice(0, 8)}`;
        const created = await authClient.organization.create({ name: publicName, slug: internalSlug });
        if (created.error || !created.data) { setError(created.error?.message ?? c.genericError); return; }
        organization = created.data;
      }

      const active = await authClient.organization.setActive({ organizationId: organization.id });
      if (active.error) { setError(active.error.message ?? c.genericError); return; }

      const response = await fetch("/api/runtime/v1/onboarding/restaurant", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicName,
          legalName: String(form.get("legalName") ?? "").trim() || undefined,
          locationName: locationName.trim(),
          slug,
          email: String(form.get("email") ?? "").trim() || undefined,
          phone: String(form.get("phone") ?? "").trim() || undefined,
          addressLine1: String(form.get("addressLine1") ?? "").trim() || undefined,
          postalCode: String(form.get("postalCode") ?? "").trim() || undefined,
          city: String(form.get("city") ?? "").trim() || undefined,
          countryCode: countryCode.trim().toUpperCase(),
          timezone: timezone.trim(),
          currency: currency.trim().toUpperCase(),
          defaultLocale,
          enabledLocales,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) { setError(payload?.message ?? c.genericError); return; }
      router.push(`/${locale}`);
      router.refresh();
    } catch { setError(c.genericError); }
    finally { setPending(false); }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)] sm:p-7">
      <section aria-labelledby="onboarding-checklist-title" className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface-muted)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="onboarding-checklist-title" className="font-semibold">{c.checklistTitle}</h2><p className="mt-1 text-xs leading-5 text-[var(--mandys-foreground-muted)]">{c.checklistHelp}</p></div>
          <strong aria-live="polite" className="text-sm">{completion}% {c.completed}</strong>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--mandys-border)]" aria-hidden="true"><div className="h-full bg-[var(--mandys-accent)] transition-[width] duration-300" style={{ width: `${completion}%` }} /></div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{checklist.map((item) => <li key={item.key} className="flex items-center gap-2 text-sm"><span aria-hidden="true" className="inline-grid size-5 place-items-center rounded-full border border-[var(--mandys-border)] text-xs">{item.complete ? "✓" : "·"}</span><span className={item.complete ? "font-medium" : "text-[var(--mandys-foreground-muted)]"}>{stepLabels[item.key]}</span></li>)}</ul>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">{c.publicName}</span><input name="publicName" value={publicName} onChange={(event) => { const next = event.target.value; setPublicName(next); if (!slugTouched) setSlug(normalizeSlug(next)); }} required minLength={2} maxLength={160} className={inputClass} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.legalName}</span><input name="legalName" maxLength={200} className={inputClass} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.locationName}</span><input name="locationName" value={locationName} onChange={(event) => setLocationName(event.target.value)} required minLength={2} maxLength={160} className={inputClass} /></label>
        <label className="sm:col-span-2" htmlFor="restaurant-slug"><span className="mb-1.5 block text-sm font-medium">{c.slug}</span><input id="restaurant-slug" name="slug" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(normalizeSlug(event.target.value)); }} required minLength={2} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" aria-describedby="restaurant-slug-help" className={`${inputClass} font-mono`} /><span id="restaurant-slug-help" className="mt-1.5 block text-xs text-[var(--mandys-foreground-muted)]">{c.slugHelp}</span></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.email}</span><input name="email" type="email" autoComplete="email" className={inputClass} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.phone}</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} className={inputClass} /></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">{c.address}</span><input name="addressLine1" autoComplete="street-address" maxLength={200} className={inputClass} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.postalCode}</span><input name="postalCode" autoComplete="postal-code" maxLength={24} className={inputClass} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.city}</span><input name="city" autoComplete="address-level2" maxLength={120} className={inputClass} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.country}</span><input name="countryCode" value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" className={`${inputClass} uppercase`} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">{c.currency}</span><input name="currency" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" className={`${inputClass} uppercase`} /></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">{c.timezone}</span><input name="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} required minLength={1} maxLength={80} className={`${inputClass} font-mono`} /></label>
      </div>

      <fieldset><legend className="text-sm font-medium">{c.languages}</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{locales.map((item) => <label key={item} className="flex items-center gap-3 rounded-xl border border-[var(--mandys-border)] px-3.5 py-3 text-sm"><input type="checkbox" checked={enabledLocales.includes(item)} onChange={(event) => setEnabledLocales((current) => event.target.checked ? [...new Set([...current, item])] : current.length === 1 ? current : current.filter((currentLocale) => currentLocale !== item))} /><span>{localeLabels[item]}</span></label>)}</div></fieldset>

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={pending || completion < 100} className="w-full rounded-xl bg-[var(--mandys-foreground)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "…" : c.submit}</button>
    </form>
  );
}
