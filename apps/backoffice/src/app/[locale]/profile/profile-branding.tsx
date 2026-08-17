"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useState } from "react";

import { MediaUploadField } from "./media-upload-field";

type ProfileData = {
  profile: {
    id: string;
    publicName: string;
    legalName: string | null;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    reservationDurationMinutes: number;
  };
  location: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;
  };
};

type ProfileResponse = { data: ProfileData };

type FormState = {
  publicName: string;
  legalName: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  contactEmail: string;
  contactPhone: string;
  reservationDurationMinutes: string;
  locationName: string;
  locationEmail: string;
  locationPhone: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  countryCode: string;
};

const copy = {
  "pt-PT": {
    publicSection: "Perfil público", publicHelp: "Estes dados alimentam o site público e os futuros canais do Mandy's.", publicName: "Nome público", legalName: "Nome legal", description: "Descrição", contactEmail: "Email de contacto", contactPhone: "Telefone de contacto", bookingDuration: "Duração padrão da reserva (min)", brand: "Identidade visual", brandHelp: "Carregue imagens diretamente quando o armazenamento estiver configurado ou use uma URL HTTPS.", logo: "Logótipo", cover: "Imagem de capa", location: "Localização principal", locationName: "Nome da localização", locationEmail: "Email da localização", locationPhone: "Telefone da localização", address1: "Morada", address2: "Complemento", postalCode: "Código postal", city: "Cidade", country: "País", save: "Guardar alterações", saving: "A guardar…", loading: "A carregar perfil…", saved: "Perfil atualizado.", retry: "Atualizar", genericError: "Não foi possível concluir a operação.", preview: "Pré-visualização", previewHelp: "Uma referência rápida da marca que será usada no storefront.", noImage: "Sem imagem de capa",
  },
  "pt-BR": {
    publicSection: "Perfil público", publicHelp: "Estes dados alimentam o site público e os futuros canais do Mandy's.", publicName: "Nome público", legalName: "Nome legal", description: "Descrição", contactEmail: "E-mail de contato", contactPhone: "Telefone de contato", bookingDuration: "Duração padrão da reserva (min)", brand: "Identidade visual", brandHelp: "Envie imagens diretamente quando o armazenamento estiver configurado ou use uma URL HTTPS.", logo: "Logotipo", cover: "Imagem de capa", location: "Unidade principal", locationName: "Nome da unidade", locationEmail: "E-mail da unidade", locationPhone: "Telefone da unidade", address1: "Endereço", address2: "Complemento", postalCode: "CEP / código postal", city: "Cidade", country: "País", save: "Salvar alterações", saving: "Salvando…", loading: "Carregando perfil…", saved: "Perfil atualizado.", retry: "Atualizar", genericError: "Não foi possível concluir a operação.", preview: "Pré-visualização", previewHelp: "Uma referência rápida da marca que será usada no storefront.", noImage: "Sem imagem de capa",
  },
  en: {
    publicSection: "Public profile", publicHelp: "These details feed the public site and future Mandy's channels.", publicName: "Public name", legalName: "Legal name", description: "Description", contactEmail: "Contact email", contactPhone: "Contact phone", bookingDuration: "Default reservation duration (min)", brand: "Brand identity", brandHelp: "Upload images directly when storage is configured, or use an HTTPS URL.", logo: "Logo", cover: "Cover image", location: "Primary location", locationName: "Location name", locationEmail: "Location email", locationPhone: "Location phone", address1: "Address", address2: "Address line 2", postalCode: "Postal code", city: "City", country: "Country", save: "Save changes", saving: "Saving…", loading: "Loading profile…", saved: "Profile updated.", retry: "Refresh", genericError: "The operation could not be completed.", preview: "Preview", previewHelp: "A quick reference of the brand that will be used by the storefront.", noImage: "No cover image",
  },
  es: {
    publicSection: "Perfil público", publicHelp: "Estos datos alimentan la web pública y los futuros canales de Mandy's.", publicName: "Nombre público", legalName: "Nombre legal", description: "Descripción", contactEmail: "Email de contacto", contactPhone: "Teléfono de contacto", bookingDuration: "Duración estándar de la reserva (min)", brand: "Identidad visual", brandHelp: "Sube imágenes directamente cuando el almacenamiento esté configurado o usa una URL HTTPS.", logo: "Logotipo", cover: "Imagen de portada", location: "Ubicación principal", locationName: "Nombre de la ubicación", locationEmail: "Email de la ubicación", locationPhone: "Teléfono de la ubicación", address1: "Dirección", address2: "Complemento", postalCode: "Código postal", city: "Ciudad", country: "País", save: "Guardar cambios", saving: "Guardando…", loading: "Cargando perfil…", saved: "Perfil actualizado.", retry: "Actualizar", genericError: "No se pudo completar la operación.", preview: "Vista previa", previewHelp: "Una referencia rápida de la marca que utilizará el storefront.", noImage: "Sin imagen de portada",
  },
} as const satisfies Record<Locale, Record<string, string>>;

const field = "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";
const textarea = `${field} min-h-28 py-3`;

function blank(): FormState {
  return { publicName: "", legalName: "", description: "", logoUrl: "", coverUrl: "", contactEmail: "", contactPhone: "", reservationDurationMinutes: "90", locationName: "", locationEmail: "", locationPhone: "", addressLine1: "", addressLine2: "", postalCode: "", city: "", countryCode: "PT" };
}

function fromData(data: ProfileData): FormState {
  return {
    publicName: data.profile.publicName,
    legalName: data.profile.legalName ?? "",
    description: data.profile.description ?? "",
    logoUrl: data.profile.logoUrl ?? "",
    coverUrl: data.profile.coverUrl ?? "",
    contactEmail: data.profile.contactEmail ?? "",
    contactPhone: data.profile.contactPhone ?? "",
    reservationDurationMinutes: String(data.profile.reservationDurationMinutes),
    locationName: data.location.name,
    locationEmail: data.location.email ?? "",
    locationPhone: data.location.phone ?? "",
    addressLine1: data.location.addressLine1 ?? "",
    addressLine2: data.location.addressLine2 ?? "",
    postalCode: data.location.postalCode ?? "",
    city: data.location.city ?? "",
    countryCode: data.location.countryCode,
  };
}

async function readMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export function ProfileBranding({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [form, setForm] = useState<FormState>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/operations/v1/settings/profile", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readMessage(response, c.genericError));
      const body = (await response.json()) as ProfileResponse;
      setForm(fromData(body.data));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : c.genericError);
    } finally {
      setLoading(false);
    }
  }, [c.genericError]);

  useEffect(() => { void load(); }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/operations/v1/settings/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, reservationDurationMinutes: Number(form.reservationDurationMinutes) }),
      });
      if (!response.ok) throw new Error(await readMessage(response, c.genericError));
      const body = (await response.json()) as ProfileResponse;
      setForm(fromData(body.data));
      setNotice(c.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : c.genericError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</div>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {error ? <div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-danger)]/30 p-4 text-sm text-[var(--mandys-danger)]">{error} <button type="button" onClick={() => void load()} className="ml-2 underline">{c.retry}</button></div> : null}
        {notice ? <div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4 text-sm">{notice}</div> : null}

        <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <h2 className="text-lg font-semibold">{c.publicSection}</h2><p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.publicHelp}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">{c.publicName}<input className={field} value={form.publicName} onChange={(e) => set("publicName", e.target.value)} required /></label>
            <label className="text-sm font-medium">{c.legalName}<input className={field} value={form.legalName} onChange={(e) => set("legalName", e.target.value)} /></label>
            <label className="text-sm font-medium md:col-span-2">{c.description}<textarea className={textarea} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.contactEmail}<input type="email" className={field} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.contactPhone}<input className={field} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.bookingDuration}<input type="number" min={30} max={480} step={15} className={field} value={form.reservationDurationMinutes} onChange={(e) => set("reservationDurationMinutes", e.target.value)} /></label>
          </div>
        </section>

        <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <h2 className="text-lg font-semibold">{c.brand}</h2><p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{c.brandHelp}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MediaUploadField locale={locale} kind="logo" label={c.logo} value={form.logoUrl} onChange={(value) => set("logoUrl", value)} />
            <MediaUploadField locale={locale} kind="cover" label={c.cover} value={form.coverUrl} onChange={(value) => set("coverUrl", value)} />
          </div>
        </section>

        <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
          <h2 className="text-lg font-semibold">{c.location}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">{c.locationName}<input className={field} value={form.locationName} onChange={(e) => set("locationName", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.city}<input className={field} value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.locationEmail}<input type="email" className={field} value={form.locationEmail} onChange={(e) => set("locationEmail", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.locationPhone}<input className={field} value={form.locationPhone} onChange={(e) => set("locationPhone", e.target.value)} /></label>
            <label className="text-sm font-medium md:col-span-2">{c.address1}<input className={field} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.address2}<input className={field} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.postalCode}<input className={field} value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></label>
            <label className="text-sm font-medium">{c.country}<input maxLength={2} className={field} value={form.countryCode} onChange={(e) => set("countryCode", e.target.value.toUpperCase())} /></label>
          </div>
        </section>

        <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving}>{saving ? c.saving : c.save}</Button></div>
      </div>

      <aside className="h-fit overflow-hidden rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] shadow-[var(--mandys-shadow-sm)] xl:sticky xl:top-24">
        <div className="aspect-[16/9] bg-[var(--mandys-surface-muted)]">
          {form.coverUrl ? <img src={form.coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm text-[var(--mandys-foreground-muted)]">{c.noImage}</div>}
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3">{form.logoUrl ? <img src={form.logoUrl} alt="" className="h-12 w-12 rounded-xl border border-[var(--mandys-border)] object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--mandys-foreground)] text-lg font-semibold text-[var(--mandys-background)]">{form.publicName.slice(0,1).toUpperCase() || "M"}</div>}<div><p className="font-semibold">{form.publicName || "Mandy's"}</p><p className="text-sm text-[var(--mandys-foreground-muted)]">{form.city || form.locationName}</p></div></div>
          <h3 className="mt-5 text-sm font-semibold">{c.preview}</h3><p className="mt-1 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{form.description || c.previewHelp}</p>
        </div>
      </aside>
    </div>
  );
}
