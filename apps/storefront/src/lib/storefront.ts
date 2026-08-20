import type { Locale } from "@mandys/i18n";
import { headers } from "next/headers";
import { cache } from "react";

import {
  getPublicApiUrl,
  normalizeStorefrontHost,
  resolveStorefrontHostname,
} from "./public-api";

export const STOREFRONT_REVALIDATE_SECONDS = 30;

export type StorefrontMenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  isFeatured: boolean;
  allergens: Array<{ id: string; code: string; name: string }>;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  description: string | null;
  items: StorefrontMenuItem[];
};

export type StorefrontMenu = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categories: StorefrontCategory[];
};

export type StorefrontData = {
  isDemo: boolean;
  locale: Locale;
  defaultLocale: Locale;
  enabledLocales: Locale[];
  currency: string;
  timezone: string;
  canonicalHostname: string | null;
  restaurant: {
    publicName: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  location: {
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;
    phone: string | null;
    email: string | null;
  };
  openingHours: Array<{
    weekday: number;
    opensAt: string;
    closesAt: string;
    isClosed: boolean;
  }>;
  specialOpeningHours: Array<{
    serviceDate: string;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
    label: string | null;
  }>;
  theme: {
    themeKey: string;
    variant: string;
    tokens: Record<string, unknown>;
  };
  menus: StorefrontMenu[];
};

type StorefrontResponse = { data: Omit<StorefrontData, "isDemo"> };

type DemoCopy = {
  description: string;
  menuName: string;
  starters: string;
  mains: string;
  desserts: string;
  oyster: string;
  oysterDescription: string;
  cuttlefish: string;
  cuttlefishDescription: string;
  seabass: string;
  seabassDescription: string;
  tart: string;
  tartDescription: string;
};

const demoCopy: Record<Locale, DemoCopy> = {
  "pt-PT": {
    description: "Peixe, marisco e cozinha de inspiração atlântica. Conceito fictício criado para demonstrar o Mandy's.",
    menuName: "Menu principal",
    starters: "Para começar",
    mains: "Do mar",
    desserts: "Sobremesas",
    oyster: "Ostras da costa",
    oysterDescription: "Limão, ervas frescas e azeite.",
    cuttlefish: "Choco frito",
    cuttlefishDescription: "Batata, salada e molho da casa.",
    seabass: "Robalo na brasa",
    seabassDescription: "Legumes da estação e molho de ervas.",
    tart: "Tarte de limão",
    tartDescription: "Merengue leve e citrinos.",
  },
  "pt-BR": {
    description: "Peixes, frutos do mar e cozinha de inspiração atlântica. Conceito fictício criado para demonstrar o Mandy's.",
    menuName: "Cardápio principal",
    starters: "Para começar",
    mains: "Do mar",
    desserts: "Sobremesas",
    oyster: "Ostras da costa",
    oysterDescription: "Limão, ervas frescas e azeite.",
    cuttlefish: "Choco frito",
    cuttlefishDescription: "Batata, salada e molho da casa.",
    seabass: "Robalo na brasa",
    seabassDescription: "Legumes da estação e molho de ervas.",
    tart: "Torta de limão",
    tartDescription: "Merengue leve e cítricos.",
  },
  en: {
    description: "Fish, shellfish and Atlantic-inspired cooking. A fictional concept created to demonstrate Mandy's.",
    menuName: "Main menu",
    starters: "To start",
    mains: "From the sea",
    desserts: "Desserts",
    oyster: "Local oysters",
    oysterDescription: "Lemon, fresh herbs and olive oil.",
    cuttlefish: "Fried cuttlefish",
    cuttlefishDescription: "Potatoes, salad and house sauce.",
    seabass: "Charcoal-grilled sea bass",
    seabassDescription: "Seasonal vegetables and herb sauce.",
    tart: "Lemon tart",
    tartDescription: "Light meringue and citrus.",
  },
  es: {
    description: "Pescado, marisco y cocina de inspiración atlántica. Concepto ficticio creado para demostrar Mandy's.",
    menuName: "Menú principal",
    starters: "Para empezar",
    mains: "Del mar",
    desserts: "Postres",
    oyster: "Ostras de la costa",
    oysterDescription: "Limón, hierbas frescas y aceite de oliva.",
    cuttlefish: "Sepia frita",
    cuttlefishDescription: "Patatas, ensalada y salsa de la casa.",
    seabass: "Lubina a la brasa",
    seabassDescription: "Verduras de temporada y salsa de hierbas.",
    tart: "Tarta de limón",
    tartDescription: "Merengue ligero y cítricos.",
  },
};

function demoStorefront(locale: Locale): StorefrontData {
  const c = demoCopy[locale];
  return {
    isDemo: true,
    locale,
    defaultLocale: "pt-PT",
    enabledLocales: ["pt-PT", "pt-BR", "en", "es"],
    currency: "EUR",
    timezone: "Europe/Lisbon",
    canonicalHostname: null,
    restaurant: {
      publicName: "Maré",
      description: c.description,
      logoUrl: null,
      coverUrl: null,
      contactEmail: "demo@mandys.local",
      contactPhone: null,
    },
    location: {
      name: "Maré · Demonstração Mandy's",
      addressLine1: "Frente ribeirinha",
      addressLine2: null,
      postalCode: null,
      city: "Setúbal",
      countryCode: "PT",
      phone: null,
      email: "demo@mandys.local",
    },
    openingHours: [
      { weekday: 0, opensAt: "12:00", closesAt: "23:00", isClosed: false },
      { weekday: 1, opensAt: "12:00", closesAt: "23:00", isClosed: false },
      { weekday: 2, opensAt: "12:00", closesAt: "23:00", isClosed: false },
      { weekday: 3, opensAt: "12:00", closesAt: "23:00", isClosed: false },
      { weekday: 4, opensAt: "12:00", closesAt: "23:30", isClosed: false },
      { weekday: 5, opensAt: "12:00", closesAt: "23:30", isClosed: false },
      { weekday: 6, opensAt: "12:00", closesAt: "23:00", isClosed: false },
    ],
    specialOpeningHours: [],
    theme: { themeKey: "minimal", variant: "light", tokens: {} },
    menus: [
      {
        id: "demo-menu",
        slug: "principal",
        name: c.menuName,
        description: null,
        categories: [
          {
            id: "demo-starters",
            name: c.starters,
            description: null,
            items: [
              {
                id: "demo-oyster",
                name: c.oyster,
                description: c.oysterDescription,
                priceCents: 1400,
                imageUrl: null,
                isFeatured: true,
                allergens: [{ id: "demo-mollusc", code: "molluscs", name: "Molluscs" }],
              },
            ],
          },
          {
            id: "demo-mains",
            name: c.mains,
            description: null,
            items: [
              {
                id: "demo-cuttlefish",
                name: c.cuttlefish,
                description: c.cuttlefishDescription,
                priceCents: 1800,
                imageUrl: null,
                isFeatured: true,
                allergens: [{ id: "demo-mollusc-2", code: "molluscs", name: "Molluscs" }],
              },
              {
                id: "demo-seabass",
                name: c.seabass,
                description: c.seabassDescription,
                priceCents: 2400,
                imageUrl: null,
                isFeatured: false,
                allergens: [{ id: "demo-fish", code: "fish", name: "Fish" }],
              },
            ],
          },
          {
            id: "demo-desserts",
            name: c.desserts,
            description: null,
            items: [
              {
                id: "demo-tart",
                name: c.tart,
                description: c.tartDescription,
                priceCents: 700,
                imageUrl: null,
                isFeatured: false,
                allergens: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

const loadStorefrontForTenant = cache(async (hostname: string, locale: Locale): Promise<StorefrontData> => {
  const params = new URLSearchParams({ hostname, locale });
  const response = await fetch(`${getPublicApiUrl()}/v1/public/storefront?${params.toString()}`, {
    headers: { accept: "application/json" },
    next: {
      revalidate: STOREFRONT_REVALIDATE_SECONDS,
      tags: [`storefront:${hostname}`, `storefront:${hostname}:${locale}`],
    },
  });

  if (!response.ok) return demoStorefront(locale);
  const body = (await response.json()) as StorefrontResponse;
  return { ...body.data, isDemo: false };
});

export async function getStorefrontData(locale: Locale): Promise<StorefrontData> {
  const requestHeaders = await headers();
  const forwardedHost = normalizeStorefrontHost(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost ?? normalizeStorefrontHost(requestHeaders.get("host"));
  const hostname = resolveStorefrontHostname(host);
  if (!hostname) return demoStorefront(locale);

  try {
    return await loadStorefrontForTenant(hostname, locale);
  } catch {
    return demoStorefront(locale);
  }
}
