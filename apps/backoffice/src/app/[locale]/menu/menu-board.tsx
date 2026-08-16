"use client";

import type { Locale } from "@mandys/contracts";
import { Button } from "@mandys/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
const supportedLocales = ["pt-PT", "pt-BR", "en", "es"] as const satisfies readonly Locale[];

type Translation = {
  locale: Locale;
  name: string;
  description: string | null;
};

type MenuItem = {
  id: string;
  priceCents: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  translations: Translation[];
  allergenIds: string[];
};

type MenuCategory = {
  id: string;
  isVisible: boolean;
  translations: Translation[];
  items: MenuItem[];
};

type Menu = {
  id: string;
  internalName: string;
  slug: string;
  isPublished: boolean;
  translations: Translation[];
  categories: MenuCategory[];
};

type MenuResponse = {
  data: {
    menus: Menu[];
    allergens: Array<{ id: string; code: string; name: string }>;
  };
};

type ErrorResponse = { message?: string };

const copy = {
  "pt-PT": {
    title: "Estruture o menu uma vez e reutilize-o no site, QR e futuros pedidos.",
    createMenu: "Criar menu",
    internalName: "Nome interno",
    slug: "Identificador",
    translations: "Nomes públicos",
    create: "Criar",
    creating: "A criar…",
    category: "Categoria",
    addCategory: "Adicionar categoria",
    item: "Prato / produto",
    addItem: "Adicionar item",
    price: "Preço (€)",
    publish: "Publicar",
    unpublish: "Retirar publicação",
    published: "Publicado",
    draft: "Rascunho",
    empty: "Ainda não existe nenhum menu.",
    emptyCategory: "Ainda não existem categorias.",
    emptyItem: "Ainda não existem itens nesta categoria.",
    loading: "A carregar menu…",
    retry: "Atualizar",
    apiMissing: "O Backoffice está publicado, mas a API ainda não está configurada neste ambiente.",
  },
  "pt-BR": {
    title: "Estruture o cardápio uma vez e reutilize no site, QR e futuros pedidos.",
    createMenu: "Criar cardápio",
    internalName: "Nome interno",
    slug: "Identificador",
    translations: "Nomes públicos",
    create: "Criar",
    creating: "Criando…",
    category: "Categoria",
    addCategory: "Adicionar categoria",
    item: "Prato / produto",
    addItem: "Adicionar item",
    price: "Preço (€)",
    publish: "Publicar",
    unpublish: "Despublicar",
    published: "Publicado",
    draft: "Rascunho",
    empty: "Ainda não existe nenhum cardápio.",
    emptyCategory: "Ainda não existem categorias.",
    emptyItem: "Ainda não existem itens nesta categoria.",
    loading: "Carregando cardápio…",
    retry: "Atualizar",
    apiMissing: "O Backoffice está publicado, mas a API ainda não está configurada neste ambiente.",
  },
  en: {
    title: "Structure the menu once and reuse it across the site, QR and future ordering.",
    createMenu: "Create menu",
    internalName: "Internal name",
    slug: "Identifier",
    translations: "Public names",
    create: "Create",
    creating: "Creating…",
    category: "Category",
    addCategory: "Add category",
    item: "Dish / product",
    addItem: "Add item",
    price: "Price (€)",
    publish: "Publish",
    unpublish: "Unpublish",
    published: "Published",
    draft: "Draft",
    empty: "No menu exists yet.",
    emptyCategory: "There are no categories yet.",
    emptyItem: "There are no items in this category yet.",
    loading: "Loading menu…",
    retry: "Refresh",
    apiMissing: "The Backoffice is deployed, but the API is not configured in this environment yet.",
  },
  es: {
    title: "Estructura el menú una vez y reutilízalo en la web, QR y futuros pedidos.",
    createMenu: "Crear menú",
    internalName: "Nombre interno",
    slug: "Identificador",
    translations: "Nombres públicos",
    create: "Crear",
    creating: "Creando…",
    category: "Categoría",
    addCategory: "Añadir categoría",
    item: "Plato / producto",
    addItem: "Añadir item",
    price: "Precio (€)",
    publish: "Publicar",
    unpublish: "Retirar publicación",
    published: "Publicado",
    draft: "Borrador",
    empty: "Todavía no existe ningún menú.",
    emptyCategory: "Todavía no existen categorías.",
    emptyItem: "Todavía no existen items en esta categoría.",
    loading: "Cargando menú…",
    retry: "Actualizar",
    apiMissing: "El Backoffice está publicado, pero la API todavía no está configurada en este entorno.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

function getName(translations: Translation[], locale: Locale): string {
  return (
    translations.find((translation) => translation.locale === locale)?.name ??
    translations.find((translation) => translation.locale === "pt-PT")?.name ??
    translations[0]?.name ??
    "—"
  );
}

function readTranslations(formData: FormData, prefix: string) {
  return supportedLocales
    .map((locale) => ({
      locale,
      name: String(formData.get(`${prefix}-${locale}`) ?? "").trim(),
    }))
    .filter((translation) => translation.name.length > 0);
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  return body.message ?? `Request failed (${response.status})`;
}

const fieldClassName =
  "mt-1.5 min-h-11 w-full rounded-[var(--mandys-radius-sm)] border border-[var(--mandys-border)] bg-transparent px-3 outline-none focus:ring-2 focus:ring-[var(--mandys-accent)]";

export function MenuBoard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(Boolean(apiBaseUrl));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(apiBaseUrl ? null : c.apiMissing);

  const moneyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }),
    [locale],
  );

  const load = useCallback(async () => {
    if (!apiBaseUrl) {
      setError(c.apiMissing);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/menu`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as MenuResponse;
      setMenus(body.data.menus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [c.apiMissing]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body: unknown) {
    if (!apiBaseUrl) throw new Error(c.apiMissing);
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await readError(response));
  }

  async function createMenuAction(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      await post("/v1/menu", {
        internalName: String(formData.get("internalName") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        translations: readTranslations(formData, "menu-name"),
      });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  async function createCategoryAction(menuId: string, formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      await post("/v1/menu/categories", {
        menuId,
        sortOrder: 0,
        isVisible: true,
        translations: readTranslations(formData, `category-name-${menuId}`),
      });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  async function createItemAction(categoryId: string, formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const price = Number(String(formData.get("price") ?? "0").replace(",", "."));
      await post("/v1/menu/items", {
        categoryId,
        priceCents: Math.round(price * 100),
        isAvailable: true,
        isFeatured: false,
        sortOrder: 0,
        allergenIds: [],
        translations: readTranslations(formData, `item-name-${categoryId}`),
      });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePublished(menu: Menu) {
    if (!apiBaseUrl) {
      setError(c.apiMissing);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/menu/${menu.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublished: !menu.isPublished }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{c.title}</p>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          {c.retry}
        </Button>
      </div>

      {error ? (
        <div className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-4 text-sm text-[var(--mandys-foreground-muted)]">
          {error}
        </div>
      ) : null}

      <section className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{c.createMenu}</h2>
        <form action={createMenuAction} className="mt-5 grid gap-4 lg:grid-cols-2" aria-disabled={submitting}>
          <label className="block text-sm font-medium">
            {c.internalName}
            <input name="internalName" minLength={2} maxLength={160} required className={fieldClassName} />
          </label>
          <label className="block text-sm font-medium">
            {c.slug}
            <input name="slug" minLength={2} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required className={fieldClassName} />
          </label>
          <fieldset className="lg:col-span-2">
            <legend className="text-sm font-medium">{c.translations}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {supportedLocales.map((translationLocale) => (
                <label key={translationLocale} className="block text-xs font-medium text-[var(--mandys-foreground-muted)]">
                  {translationLocale}
                  <input
                    name={`menu-name-${translationLocale}`}
                    required={translationLocale === locale}
                    maxLength={160}
                    className={fieldClassName}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="lg:col-span-2">
            <Button type="submit" disabled={submitting || !apiBaseUrl}>
              {submitting ? c.creating : c.create}
            </Button>
          </div>
        </form>
      </section>

      {loading ? (
        <div className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-6 text-sm text-[var(--mandys-foreground-muted)]">
          {c.loading}
        </div>
      ) : menus.length === 0 ? (
        <div className="rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] p-8 text-center text-sm text-[var(--mandys-foreground-muted)]">
          {c.empty}
        </div>
      ) : (
        menus.map((menu) => (
          <section key={menu.id} className="rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{getName(menu.translations, locale)}</h2>
                  <span className="rounded-full bg-[var(--mandys-surface-muted)] px-2.5 py-1 text-xs font-medium">
                    {menu.isPublished ? c.published : c.draft}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--mandys-foreground-muted)]">{menu.internalName} · /{menu.slug}</p>
              </div>
              <Button variant="secondary" size="sm" disabled={submitting} onClick={() => void togglePublished(menu)}>
                {menu.isPublished ? c.unpublish : c.publish}
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              {menu.categories.length === 0 ? (
                <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.emptyCategory}</p>
              ) : (
                menu.categories.map((category) => (
                  <article key={category.id} className="rounded-[var(--mandys-radius-md)] border border-[var(--mandys-border)] p-4 sm:p-5">
                    <h3 className="font-semibold">{getName(category.translations, locale)}</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {category.items.length === 0 ? (
                        <p className="text-sm text-[var(--mandys-foreground-muted)]">{c.emptyItem}</p>
                      ) : (
                        category.items.map((item) => (
                          <div key={item.id} className="rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-surface-muted)] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium">{getName(item.translations, locale)}</p>
                              <span className="text-sm font-semibold">{moneyFormatter.format(item.priceCents / 100)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <form action={createItemAction.bind(null, category.id)} className="mt-5 border-t border-[var(--mandys-border)] pt-5">
                      <p className="text-sm font-semibold">{c.addItem}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {supportedLocales.map((translationLocale) => (
                          <label key={translationLocale} className="block text-xs font-medium text-[var(--mandys-foreground-muted)]">
                            {translationLocale}
                            <input
                              name={`item-name-${category.id}-${translationLocale}`}
                              required={translationLocale === locale}
                              maxLength={160}
                              className={fieldClassName}
                            />
                          </label>
                        ))}
                        <label className="block text-xs font-medium text-[var(--mandys-foreground-muted)]">
                          {c.price}
                          <input name="price" type="number" min="0" step="0.01" required className={fieldClassName} />
                        </label>
                      </div>
                      <Button type="submit" size="sm" className="mt-3" disabled={submitting || !apiBaseUrl}>
                        {c.addItem}
                      </Button>
                    </form>
                  </article>
                ))
              )}
            </div>

            <form action={createCategoryAction.bind(null, menu.id)} className="mt-6 border-t border-[var(--mandys-border)] pt-5">
              <p className="text-sm font-semibold">{c.addCategory}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {supportedLocales.map((translationLocale) => (
                  <label key={translationLocale} className="block text-xs font-medium text-[var(--mandys-foreground-muted)]">
                    {translationLocale}
                    <input
                      name={`category-name-${menu.id}-${translationLocale}`}
                      required={translationLocale === locale}
                      maxLength={160}
                      className={fieldClassName}
                    />
                  </label>
                ))}
              </div>
              <Button type="submit" size="sm" className="mt-3" disabled={submitting || !apiBaseUrl}>
                {c.addCategory}
              </Button>
            </form>
          </section>
        ))
      )}
    </div>
  );
}
