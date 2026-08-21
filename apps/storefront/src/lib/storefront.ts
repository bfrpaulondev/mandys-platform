import type { Locale } from "@mandys/i18n";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  getPublicApiUrl,
  normalizeStorefrontHost,
  resolveStorefrontHostname,
} from "./public-api";

export const STOREFRONT_REVALIDATE_SECONDS = 30;

export class StorefrontUnavailableError extends Error {
  constructor(status?: number) {
    super(
      status
        ? `Restaurant storefront runtime returned HTTP ${status}`
        : "Restaurant storefront runtime is unavailable",
    );
    this.name = "StorefrontUnavailableError";
  }
}

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
  // Kept for page compatibility while legacy demo rendering is removed. A
  // successful runtime response is always live DB-backed data.
  isDemo: false;
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

export function classifyStorefrontResponseStatus(
  status: number,
): "ok" | "not-found" | "unavailable" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404) return "not-found";
  return "unavailable";
}

const loadStorefrontForTenant = cache(
  async (hostname: string, locale: Locale): Promise<StorefrontData> => {
    const params = new URLSearchParams({ hostname, locale });
    let response: Response;
    try {
      response = await fetch(
        `${getPublicApiUrl()}/v1/public/storefront?${params.toString()}`,
        {
          headers: { accept: "application/json" },
          next: {
            revalidate: STOREFRONT_REVALIDATE_SECONDS,
            tags: [`storefront:${hostname}`, `storefront:${hostname}:${locale}`],
          },
        },
      );
    } catch {
      throw new StorefrontUnavailableError();
    }

    const classification = classifyStorefrontResponseStatus(response.status);
    if (classification === "not-found") notFound();
    if (classification === "unavailable") {
      throw new StorefrontUnavailableError(response.status);
    }

    const body = (await response.json().catch(() => null)) as StorefrontResponse | null;
    if (
      !body?.data?.restaurant?.publicName ||
      !body.data.location ||
      !Array.isArray(body.data.openingHours) ||
      !Array.isArray(body.data.specialOpeningHours) ||
      !Array.isArray(body.data.menus)
    ) {
      throw new StorefrontUnavailableError();
    }

    return { ...body.data, isDemo: false };
  },
);

export async function getStorefrontData(locale: Locale): Promise<StorefrontData> {
  const requestHeaders = await headers();
  const forwardedHost = normalizeStorefrontHost(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost ?? normalizeStorefrontHost(requestHeaders.get("host"));
  const hostname = resolveStorefrontHostname(host);
  if (!hostname) notFound();
  return loadStorefrontForTenant(hostname, locale);
}
