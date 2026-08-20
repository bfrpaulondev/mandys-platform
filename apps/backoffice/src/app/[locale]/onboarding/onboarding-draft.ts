import type { Locale } from "@mandys/i18n";

export type OnboardingDraftFields = {
  publicName: string;
  slug: string;
  locationName: string;
  countryCode: string;
  timezone: string;
  currency: string;
  enabledLocales: Locale[];
};

type StoredOnboardingDraft = {
  version: 1;
  expiresAt: number;
  fields: OnboardingDraftFields;
};

const draftLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const localeSet = new Set<Locale>(["pt-PT", "pt-BR", "en", "es"]);

export function onboardingDraftKey(userId: string): string {
  return `mandys:onboarding-draft:v1:${userId}`;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length > max) return null;
  return value;
}

export function serializeOnboardingDraft(fields: OnboardingDraftFields, now = Date.now()): string {
  const draft: StoredOnboardingDraft = {
    version: 1,
    expiresAt: now + draftLifetimeMs,
    fields,
  };
  return JSON.stringify(draft);
}

export function parseOnboardingDraft(raw: string | null, now = Date.now()): OnboardingDraftFields | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredOnboardingDraft>;
    if (value.version !== 1 || typeof value.expiresAt !== "number" || value.expiresAt <= now || !value.fields) return null;
    const publicName = text(value.fields.publicName, 160);
    const slug = text(value.fields.slug, 80);
    const locationName = text(value.fields.locationName, 160);
    const countryCode = text(value.fields.countryCode, 2);
    const timezone = text(value.fields.timezone, 80);
    const currency = text(value.fields.currency, 3);
    if ([publicName, slug, locationName, countryCode, timezone, currency].some((item) => item === null)) return null;
    if (!Array.isArray(value.fields.enabledLocales)) return null;
    const enabledLocales = [...new Set(value.fields.enabledLocales.filter((item): item is Locale => localeSet.has(item as Locale)))];
    if (enabledLocales.length === 0) return null;
    return {
      publicName: publicName!,
      slug: slug!,
      locationName: locationName!,
      countryCode: countryCode!,
      timezone: timezone!,
      currency: currency!,
      enabledLocales,
    };
  } catch {
    return null;
  }
}
