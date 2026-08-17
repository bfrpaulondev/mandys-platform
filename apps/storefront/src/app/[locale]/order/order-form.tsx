"use client";

import type { Locale } from "@mandys/i18n";
import { useMemo, useRef, useState } from "react";

type CatalogItem = { id: string; name: string; description: string | null; priceCents: number; categoryName: string };
type OrderCreated = { data: { id: string; orderNumber: number; status: string; currency: string; totalCents: number; paymentMethod: string; fulfillmentType: string } };
type ErrorResponse = { error?: string; message?: string };

const copy = {
  "pt-PT": { menu: "Escolha os itens", cart: "O seu pedido", empty: "Adicione pelo menos um item.", quantity: "Quantidade", subtotal: "Total", name: "Nome", email: "Email", phone: "Telefone", notes: "Observações para a cozinha", contactHelp: "Indique email ou telefone para o restaurante poder confirmar o levantamento.", submit: "Enviar pedido", submitting: "A enviar…", payment: "Pagamento no levantamento", pickup: "Takeaway / levantamento", success: "Pedido #{number} recebido. O restaurante pode agora aceitá-lo e prepará-lo no Mandy's.", error: "Não foi possível enviar o pedido. Reveja os dados e tente novamente.", unavailable: "Um dos itens deixou de estar disponível. Atualize a página para ver o menu atual." },
  "pt-BR": { menu: "Escolha os itens", cart: "Seu pedido", empty: "Adicione pelo menos um item.", quantity: "Quantidade", subtotal: "Total", name: "Nome", email: "E-mail", phone: "Telefone", notes: "Observações para a cozinha", contactHelp: "Informe e-mail ou telefone para o restaurante confirmar a retirada.", submit: "Enviar pedido", submitting: "Enviando…", payment: "Pagamento na retirada", pickup: "Takeaway / retirada", success: "Pedido #{number} recebido. O restaurante agora pode aceitá-lo e prepará-lo no Mandy's.", error: "Não foi possível enviar o pedido. Revise os dados e tente novamente.", unavailable: "Um dos itens não está mais disponível. Atualize a página para ver o cardápio atual." },
  en: { menu: "Choose items", cart: "Your order", empty: "Add at least one item.", quantity: "Quantity", subtotal: "Total", name: "Name", email: "Email", phone: "Phone", notes: "Kitchen notes", contactHelp: "Provide an email or phone number so the restaurant can confirm pickup.", submit: "Place order", submitting: "Sending…", payment: "Pay at pickup", pickup: "Takeaway / pickup", success: "Order #{number} received. The restaurant can now accept and prepare it in Mandy's.", error: "The order could not be sent. Check the details and try again.", unavailable: "One of the items is no longer available. Refresh the page to see the current menu." },
  es: { menu: "Elige los artículos", cart: "Tu pedido", empty: "Añade al menos un artículo.", quantity: "Cantidad", subtotal: "Total", name: "Nombre", email: "Email", phone: "Teléfono", notes: "Observaciones para cocina", contactHelp: "Indica email o teléfono para que el restaurante pueda confirmar la recogida.", submit: "Enviar pedido", submitting: "Enviando…", payment: "Pago al recoger", pickup: "Takeaway / recogida", success: "Pedido #{number} recibido. El restaurante ya puede aceptarlo y prepararlo en Mandy's.", error: "No se pudo enviar el pedido. Revisa los datos e inténtalo de nuevo.", unavailable: "Uno de los artículos ya no está disponible. Actualiza la página para ver la carta actual." },
} as const satisfies Record<Locale, Record<string, string>>;

const fieldClassName = "mt-1.5 min-h-12 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-[var(--mandys-background)] px-3 text-[var(--mandys-foreground)] outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

export function OrderForm({ locale, currency, items }: { locale: Locale; currency: string; items: CatalogItem[] }) {
  const c = copy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [currency, locale]);
  const selected = useMemo(() => items.filter((item) => (quantities[item.id] ?? 0) > 0), [items, quantities]);
  const total = selected.reduce((sum, item) => sum + item.priceCents * (quantities[item.id] ?? 0), 0);
  const categories = useMemo(() => [...new Set(items.map((item) => item.categoryName))], [items]);

  function changeQuantity(id: string, delta: number) {
    setMessage(null);
    setQuantities((current) => {
      const next = Math.max(0, Math.min(100, (current[id] ?? 0) + delta));
      return { ...current, [id]: next };
    });
  }

  async function submit(formData: FormData) {
    if (selected.length === 0) { setSuccess(false); setMessage(c.empty); return; }
    const guestEmail = String(formData.get("guestEmail") ?? "").trim();
    const guestPhone = String(formData.get("guestPhone") ?? "").trim();
    if (!guestEmail && !guestPhone) { setSuccess(false); setMessage(c.contactHelp); return; }
    setSubmitting(true); setMessage(null); setSuccess(false);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale,
          guestName: String(formData.get("guestName") ?? ""),
          ...(guestEmail ? { guestEmail } : {}),
          ...(guestPhone ? { guestPhone } : {}),
          ...(formData.get("notes") ? { notes: String(formData.get("notes")) } : {}),
          items: selected.map((item) => ({ menuItemId: item.id, quantity: quantities[item.id] ?? 0 })),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as OrderCreated & ErrorResponse;
      if (!response.ok) {
        if (body.error === "CATALOG_CHANGED") { setMessage(c.unavailable); return; }
        throw new Error(body.message ?? "order_failed");
      }
      setQuantities({});
      formRef.current?.reset();
      setSuccess(true);
      setMessage(c.success.replace("{number}", String(body.data.orderNumber)));
    } catch {
      setSuccess(false); setMessage(c.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section>
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">{c.menu}</h2>
        <div className="mt-5 space-y-8">
          {categories.map((category) => <div key={category}><h3 className="border-b border-[var(--mandys-border)] pb-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--mandys-foreground-muted)]">{category}</h3><div className="divide-y divide-[var(--mandys-border)]">{items.filter((item) => item.categoryName === category).map((item) => {
            const quantity = quantities[item.id] ?? 0;
            return <article key={item.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><h4 className="font-medium">{item.name}</h4>{item.description ? <p className="mt-1 text-sm leading-5 text-[var(--mandys-foreground-muted)]">{item.description}</p> : null}<p className="mt-2 text-sm font-semibold">{money.format(item.priceCents / 100)}</p></div><div className="flex shrink-0 items-center gap-2" aria-label={`${c.quantity}: ${item.name}`}><button type="button" onClick={() => changeQuantity(item.id, -1)} disabled={quantity === 0} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--mandys-border)] text-lg disabled:opacity-30">−</button><span className="w-7 text-center text-sm font-semibold">{quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--mandys-border)] text-lg">+</button></div></article>;
          })}</div></div>)}
        </div>
      </section>

      <aside className="h-fit rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 shadow-[var(--mandys-shadow-sm)] sm:p-6 lg:sticky lg:top-6">
        <h2 className="text-xl font-semibold">{c.cart}</h2>
        <div className="mt-4 space-y-2">{selected.length === 0 ? <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.empty}</p> : selected.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{quantities[item.id]}× {item.name}</span><span className="whitespace-nowrap">{money.format(item.priceCents * (quantities[item.id] ?? 0) / 100)}</span></div>)}</div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--mandys-border)] pt-4 font-semibold"><span>{c.subtotal}</span><span>{money.format(total / 100)}</span></div>
        <div className="mt-3 rounded-md bg-[var(--mandys-surface-muted)] p-3 text-xs leading-5 text-[var(--mandys-foreground-muted)]">{c.pickup} · {c.payment}</div>
        <form ref={formRef} action={submit} className="mt-5 space-y-3">
          <label className="block text-sm font-medium">{c.name}<input name="guestName" required minLength={2} maxLength={160} autoComplete="name" className={fieldClassName} /></label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><label className="block text-sm font-medium">{c.email}<input name="guestEmail" type="email" autoComplete="email" className={fieldClassName} /></label><label className="block text-sm font-medium">{c.phone}<input name="guestPhone" type="tel" maxLength={40} autoComplete="tel" className={fieldClassName} /></label></div>
          <p className="text-xs leading-5 text-[var(--mandys-foreground-muted)]">{c.contactHelp}</p>
          <label className="block text-sm font-medium">{c.notes}<textarea name="notes" rows={3} maxLength={2000} className={`${fieldClassName} py-3`} /></label>
          <button type="submit" disabled={submitting || selected.length === 0} className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-accent)] px-5 text-sm font-semibold text-[var(--mandys-accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? c.submitting : c.submit}</button>
          {message ? <p role="status" data-state={success ? "success" : "error"} className={`text-sm leading-6 ${success ? "text-[var(--mandys-foreground)]" : "text-[var(--mandys-foreground-muted)]"}`}>{message}</p> : null}
        </form>
      </aside>
    </div>
  );
}
