"use client";

import type { Locale } from "@mandys/i18n";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Customer = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  preferredLocale: Locale | null;
  notes: string | null;
  marketingConsentAt: string | null;
  createdAt: string;
  reservationCount?: number;
  lastReservationAt?: string | null;
};

type Reservation = { id: string; startsAt: string; partySize: number; status: string; source: string };
type CustomerDetail = Customer & { reservations: Reservation[] };
type Pagination = { limit: number; offset: number; hasMore: boolean };

const PAGE_SIZE = 25;

const copy = {
  "pt-PT": { search: "Pesquisar cliente", newCustomer: "Novo cliente", firstName: "Nome", lastName: "Apelido", email: "Email", phone: "Telefone", locale: "Idioma preferido", notes: "Notas", marketing: "Consentimento de marketing", save: "Guardar", saving: "A guardar…", create: "Criar cliente", loading: "A carregar clientes…", noCustomers: "Ainda não existem clientes.", select: "Selecione um cliente para ver o perfil.", history: "Histórico de reservas", noHistory: "Sem reservas associadas.", reservations: "reservas", lastVisit: "Última reserva", saved: "Cliente atualizado.", created: "Cliente criado.", genericError: "Não foi possível concluir a operação.", retry: "Atualizar", status: "Estado", party: "pessoas", previous: "Anterior", next: "Seguinte", page: "Página" },
  "pt-BR": { search: "Pesquisar cliente", newCustomer: "Novo cliente", firstName: "Nome", lastName: "Sobrenome", email: "E-mail", phone: "Telefone", locale: "Idioma preferido", notes: "Notas", marketing: "Consentimento de marketing", save: "Salvar", saving: "Salvando…", create: "Criar cliente", loading: "Carregando clientes…", noCustomers: "Ainda não há clientes.", select: "Selecione um cliente para ver o perfil.", history: "Histórico de reservas", noHistory: "Sem reservas associadas.", reservations: "reservas", lastVisit: "Última reserva", saved: "Cliente atualizado.", created: "Cliente criado.", genericError: "Não foi possível concluir a operação.", retry: "Atualizar", status: "Status", party: "pessoas", previous: "Anterior", next: "Próxima", page: "Página" },
  en: { search: "Search customer", newCustomer: "New customer", firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", locale: "Preferred language", notes: "Notes", marketing: "Marketing consent", save: "Save", saving: "Saving…", create: "Create customer", loading: "Loading customers…", noCustomers: "There are no customers yet.", select: "Select a customer to view the profile.", history: "Reservation history", noHistory: "No linked reservations.", reservations: "reservations", lastVisit: "Last reservation", saved: "Customer updated.", created: "Customer created.", genericError: "The operation could not be completed.", retry: "Refresh", status: "Status", party: "guests", previous: "Previous", next: "Next", page: "Page" },
  es: { search: "Buscar cliente", newCustomer: "Nuevo cliente", firstName: "Nombre", lastName: "Apellidos", email: "Email", phone: "Teléfono", locale: "Idioma preferido", notes: "Notas", marketing: "Consentimiento de marketing", save: "Guardar", saving: "Guardando…", create: "Crear cliente", loading: "Cargando clientes…", noCustomers: "Todavía no hay clientes.", select: "Selecciona un cliente para ver el perfil.", history: "Historial de reservas", noHistory: "Sin reservas asociadas.", reservations: "reservas", lastVisit: "Última reserva", saved: "Cliente actualizado.", created: "Cliente creado.", genericError: "No se pudo completar la operación.", retry: "Actualizar", status: "Estado", party: "personas", previous: "Anterior", next: "Siguiente", page: "Página" },
} as const satisfies Record<Locale, Record<string, string>>;

const field = "min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

async function readMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export function CustomerBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);

  const loadCustomers = useCallback(async (search = "", nextOffset = 0) => {
    setLoading(true); setError(null);
    try {
      const normalizedSearch = search.trim();
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
      if (normalizedSearch) params.set("q", normalizedSearch);
      const response = await fetch(`/api/crm/v1/customers?${params.toString()}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await readMessage(response, c.genericError));
      const body = (await response.json()) as { data: Customer[]; pagination: Pagination };
      setCustomers(body.data);
      setActiveQuery(normalizedSearch);
      setOffset(body.pagination.offset);
      setHasMore(body.pagination.hasMore);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : c.genericError); }
    finally { setLoading(false); }
  }, [c.genericError]);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  async function openCustomer(id: string) {
    setError(null); setNotice(null);
    const response = await fetch(`/api/crm/v1/customers/${id}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) { setError(await readMessage(response, c.genericError)); return; }
    const body = (await response.json()) as { data: CustomerDetail };
    setSelected(body.data);
  }

  async function createCustomer(formData: FormData) {
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/crm/v1/customers", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: String(formData.get("firstName") ?? ""), lastName: String(formData.get("lastName") ?? ""), email: String(formData.get("email") ?? ""), phone: String(formData.get("phone") ?? ""), preferredLocale: String(formData.get("preferredLocale") ?? locale), notes: String(formData.get("notes") ?? ""), marketingConsent: formData.get("marketingConsent") === "on" }) });
      if (!response.ok) throw new Error(await readMessage(response, c.genericError));
      const body = (await response.json()) as { data: CustomerDetail };
      setSelected(body.data); setNotice(c.created); await loadCustomers(activeQuery, offset);
    } catch (createError) { setError(createError instanceof Error ? createError.message : c.genericError); }
    finally { setSaving(false); }
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/crm/v1/customers/${selected.id}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: selected.firstName, lastName: selected.lastName ?? "", email: selected.email ?? "", phone: selected.phone ?? "", preferredLocale: selected.preferredLocale ?? locale, notes: selected.notes ?? "", marketingConsent: Boolean(selected.marketingConsentAt) }) });
      if (!response.ok) throw new Error(await readMessage(response, c.genericError));
      const body = (await response.json()) as { data: CustomerDetail };
      setSelected(body.data); setNotice(c.saved); await loadCustomers(activeQuery, offset);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : c.genericError); }
    finally { setSaving(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 shadow-[var(--mandys-shadow-sm)]">
          <form onSubmit={(event) => { event.preventDefault(); void loadCustomers(query, 0); }} className="flex gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search} className={field} /><Button type="submit" variant="secondary">{c.search}</Button></form>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
            {loading ? <p className="p-3 text-sm text-[var(--mandys-foreground-muted)]">{c.loading}</p> : customers.length === 0 ? <p className="p-3 text-sm text-[var(--mandys-foreground-muted)]">{c.noCustomers}</p> : customers.map((customer) => <button key={customer.id} type="button" onClick={() => void openCustomer(customer.id)} className={`w-full rounded-[var(--mandys-radius-sm)] border p-3 text-left transition ${selected?.id === customer.id ? "border-[var(--mandys-foreground)]" : "border-[var(--mandys-border)] hover:bg-[var(--mandys-surface-muted)]"}`}><p className="font-medium">{customer.firstName} {customer.lastName}</p><p className="mt-1 truncate text-xs text-[var(--mandys-foreground-muted)]">{customer.email || customer.phone || "—"}</p><p className="mt-2 text-xs text-[var(--mandys-foreground-muted)]">{customer.reservationCount ?? 0} {c.reservations}</p></button>)}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--mandys-border)] pt-4">
            <Button type="button" size="sm" variant="secondary" disabled={loading || offset === 0} onClick={() => void loadCustomers(activeQuery, Math.max(0, offset - PAGE_SIZE))}>{c.previous}</Button>
            <span className="text-xs text-[var(--mandys-foreground-muted)]">{c.page} {Math.floor(offset / PAGE_SIZE) + 1}</span>
            <Button type="button" size="sm" variant="secondary" disabled={loading || !hasMore} onClick={() => void loadCustomers(activeQuery, offset + PAGE_SIZE)}>{c.next}</Button>
          </div>
        </section>

        <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 shadow-[var(--mandys-shadow-sm)]">
          <h2 className="font-semibold">{c.newCustomer}</h2>
          <form action={createCustomer} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2"><input name="firstName" required placeholder={c.firstName} className={field} /><input name="lastName" placeholder={c.lastName} className={field} /></div>
            <input name="email" type="email" placeholder={c.email} className={field} /><input name="phone" placeholder={c.phone} className={field} />
            <select name="preferredLocale" defaultValue={locale} className={field}><option value="pt-PT">Português (PT)</option><option value="pt-BR">Português (BR)</option><option value="en">English</option><option value="es">Español</option></select>
            <textarea name="notes" placeholder={c.notes} className={`${field} min-h-24 py-3`} />
            <label className="flex items-center gap-2 text-sm"><input name="marketingConsent" type="checkbox" />{c.marketing}</label>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? c.saving : c.create}</Button>
          </form>
        </section>
      </aside>

      <section className="min-w-0">
        {error ? <div className="mb-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-danger)]/30 p-4 text-sm text-[var(--mandys-danger)]">{error} <button type="button" onClick={() => void loadCustomers(activeQuery, offset)} className="ml-2 underline">{c.retry}</button></div> : null}
        {notice ? <div className="mb-4 rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4 text-sm">{notice}</div> : null}
        {!selected ? <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-12 text-center text-sm text-[var(--mandys-foreground-muted)]">{c.select}</div> : (
          <div className="space-y-6">
            <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold tracking-[-0.03em]">{selected.firstName} {selected.lastName}</h2><p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{selected.reservationCount ?? selected.reservations.length} {c.reservations}{selected.lastReservationAt ? ` · ${c.lastVisit}: ${dateFormatter.format(new Date(selected.lastReservationAt))}` : ""}</p></div><Button onClick={() => void saveSelected()} disabled={saving}>{saving ? c.saving : c.save}</Button></div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">{c.firstName}<input className={`mt-1.5 ${field}`} value={selected.firstName} onChange={(e) => setSelected({ ...selected, firstName: e.target.value })} /></label>
                <label className="text-sm font-medium">{c.lastName}<input className={`mt-1.5 ${field}`} value={selected.lastName ?? ""} onChange={(e) => setSelected({ ...selected, lastName: e.target.value })} /></label>
                <label className="text-sm font-medium">{c.email}<input type="email" className={`mt-1.5 ${field}`} value={selected.email ?? ""} onChange={(e) => setSelected({ ...selected, email: e.target.value })} /></label>
                <label className="text-sm font-medium">{c.phone}<input className={`mt-1.5 ${field}`} value={selected.phone ?? ""} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} /></label>
                <label className="text-sm font-medium">{c.locale}<select className={`mt-1.5 ${field}`} value={selected.preferredLocale ?? locale} onChange={(e) => setSelected({ ...selected, preferredLocale: e.target.value as Locale })}><option value="pt-PT">Português (PT)</option><option value="pt-BR">Português (BR)</option><option value="en">English</option><option value="es">Español</option></select></label>
                <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={Boolean(selected.marketingConsentAt)} onChange={(e) => setSelected({ ...selected, marketingConsentAt: e.target.checked ? new Date().toISOString() : null })} />{c.marketing}</label>
                <label className="text-sm font-medium md:col-span-2">{c.notes}<textarea className={`mt-1.5 ${field} min-h-28 py-3`} value={selected.notes ?? ""} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></label>
              </div>
            </section>

            <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)]">
              <h2 className="text-lg font-semibold">{c.history}</h2>
              {selected.reservations.length === 0 ? <p className="mt-3 text-sm text-[var(--mandys-foreground-muted)]">{c.noHistory}</p> : <div className="mt-4 divide-y divide-[var(--mandys-border)]">{selected.reservations.map((reservation) => <div key={reservation.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"><span className="text-sm font-medium">{dateFormatter.format(new Date(reservation.startsAt))}</span><span className="text-sm text-[var(--mandys-foreground-muted)]">{reservation.partySize} {c.party}</span><span className="text-xs uppercase tracking-wide text-[var(--mandys-foreground-muted)]">{c.status}: {reservation.status}</span></div>)}</div>}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}