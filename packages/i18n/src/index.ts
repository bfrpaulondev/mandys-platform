export const locales = ["pt-PT", "pt-BR", "en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt-PT";

export const localeLabels: Record<Locale, string> = {
  "pt-PT": "Português (Portugal)",
  "pt-BR": "Português (Brasil)",
  en: "English",
  es: "Español",
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function resolveLocale(value?: string | null): Locale {
  if (!value) return defaultLocale;
  if (isLocale(value)) return value;

  const normalized = value.toLowerCase();
  if (normalized.startsWith("pt-br")) return "pt-BR";
  if (normalized.startsWith("pt")) return "pt-PT";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("en")) return "en";
  return defaultLocale;
}

export const coreMessages = {
  "pt-PT": {
    appName: "Mandy's",
    dashboard: "Visão geral",
    reservations: "Reservas",
    menu: "Menu",
    customers: "Clientes",
    events: "Eventos",
    settings: "Definições",
    today: "Hoje",
    welcome: "Bem-vindo ao Mandy's",
  },
  "pt-BR": {
    appName: "Mandy's",
    dashboard: "Visão geral",
    reservations: "Reservas",
    menu: "Cardápio",
    customers: "Clientes",
    events: "Eventos",
    settings: "Configurações",
    today: "Hoje",
    welcome: "Bem-vindo ao Mandy's",
  },
  en: {
    appName: "Mandy's",
    dashboard: "Overview",
    reservations: "Reservations",
    menu: "Menu",
    customers: "Customers",
    events: "Events",
    settings: "Settings",
    today: "Today",
    welcome: "Welcome to Mandy's",
  },
  es: {
    appName: "Mandy's",
    dashboard: "Resumen",
    reservations: "Reservas",
    menu: "Carta",
    customers: "Clientes",
    events: "Eventos",
    settings: "Configuración",
    today: "Hoy",
    welcome: "Bienvenido a Mandy's",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type CoreMessageKey = keyof (typeof coreMessages)["pt-PT"];

export function t(locale: Locale, key: CoreMessageKey): string {
  return coreMessages[locale][key];
}
