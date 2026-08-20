import { isSupportedCountryCode, isSupportedCurrencyCode, isValidIanaTimezone } from "@mandys/contracts";
import type { Locale } from "@mandys/i18n";

export type OnboardingProgressInput = {
  publicName: string;
  slug: string;
  locationName: string;
  countryCode: string;
  timezone: string;
  currency: string;
  defaultLocale: Locale;
  enabledLocales: Locale[];
};

export type OnboardingChecklistKey = "identity" | "location" | "regional" | "languages";

export type OnboardingChecklistItem = {
  key: OnboardingChecklistKey;
  complete: boolean;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getOnboardingChecklist(input: OnboardingProgressInput): OnboardingChecklistItem[] {
  const enabledLocales = new Set(input.enabledLocales);

  return [
    {
      key: "identity",
      complete:
        input.publicName.trim().length >= 2 &&
        input.publicName.trim().length <= 160 &&
        input.slug.length >= 2 &&
        input.slug.length <= 80 &&
        slugPattern.test(input.slug),
    },
    {
      key: "location",
      complete:
        input.locationName.trim().length >= 2 &&
        input.locationName.trim().length <= 160 &&
        isSupportedCountryCode(input.countryCode),
    },
    {
      key: "regional",
      complete:
        isValidIanaTimezone(input.timezone) &&
        isSupportedCurrencyCode(input.currency),
    },
    {
      key: "languages",
      complete:
        input.enabledLocales.length > 0 &&
        input.enabledLocales.length <= 4 &&
        enabledLocales.size === input.enabledLocales.length &&
        enabledLocales.has(input.defaultLocale),
    },
  ];
}

export function onboardingCompletionPercent(items: OnboardingChecklistItem[]): number {
  if (items.length === 0) return 0;
  const complete = items.filter((item) => item.complete).length;
  return Math.round((complete / items.length) * 100);
}
