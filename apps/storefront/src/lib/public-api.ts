const DEFAULT_PUBLIC_API_URL =
  "https://dbfmjdissqsdhxhmqkqp.supabase.co/functions/v1/mandys-public";
const DEMO_HOSTNAME = "demo.mandys.local";

export function normalizeStorefrontHost(value: string | null): string | null {
  if (!value) return null;
  const host = value.split(",")[0]?.trim().toLowerCase().split(":")[0];
  return host || null;
}

export function getPublicApiUrl(): string {
  return (
    process.env.MANDYS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_PUBLIC_API_URL
  ).replace(/\/$/, "");
}

export function resolveStorefrontHostname(host: string | null): string | null {
  const configured = normalizeStorefrontHost(process.env.MANDYS_STOREFRONT_HOSTNAME ?? null);
  if (configured) return configured;

  const normalized = normalizeStorefrontHost(host);
  if (!normalized) return null;

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".vercel.app") ||
    normalized.endsWith(".netlify.app")
  ) {
    return DEMO_HOSTNAME;
  }

  return normalized;
}
