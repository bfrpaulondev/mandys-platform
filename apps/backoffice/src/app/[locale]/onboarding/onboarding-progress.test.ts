import { describe, expect, it } from "vitest";

import { getOnboardingChecklist, onboardingCompletionPercent } from "./onboarding-progress";

const completeInput = {
  publicName: "Mandy's Bistro",
  slug: "mandys-bistro",
  locationName: "Principal",
  countryCode: "PT",
  timezone: "Europe/Lisbon",
  currency: "EUR",
  defaultLocale: "pt-PT" as const,
  enabledLocales: ["pt-PT", "en"] as const,
};

describe("onboarding checklist", () => {
  it("reports complete setup fields", () => {
    const items = getOnboardingChecklist({ ...completeInput, enabledLocales: [...completeInput.enabledLocales] });
    expect(items.every((item) => item.complete)).toBe(true);
    expect(onboardingCompletionPercent(items)).toBe(100);
  });

  it("keeps identity incomplete for an invalid slug", () => {
    const items = getOnboardingChecklist({ ...completeInput, enabledLocales: [...completeInput.enabledLocales], slug: "Invalid Slug" });
    expect(items.find((item) => item.key === "identity")?.complete).toBe(false);
    expect(onboardingCompletionPercent(items)).toBe(75);
  });

  it("rejects unknown country codes", () => {
    const items = getOnboardingChecklist({ ...completeInput, enabledLocales: [...completeInput.enabledLocales], countryCode: "ZZ" });
    expect(items.find((item) => item.key === "location")?.complete).toBe(false);
  });

  it("rejects unsupported currencies and invalid IANA timezones", () => {
    const badCurrency = getOnboardingChecklist({ ...completeInput, enabledLocales: [...completeInput.enabledLocales], currency: "ZZZ" });
    expect(badCurrency.find((item) => item.key === "regional")?.complete).toBe(false);

    const badTimezone = getOnboardingChecklist({ ...completeInput, enabledLocales: [...completeInput.enabledLocales], timezone: "Mars/Olympus" });
    expect(badTimezone.find((item) => item.key === "regional")?.complete).toBe(false);
  });

  it("requires unique enabled locales and the default locale to remain enabled", () => {
    const missingDefault = getOnboardingChecklist({ ...completeInput, enabledLocales: ["en"] });
    expect(missingDefault.find((item) => item.key === "languages")?.complete).toBe(false);

    const duplicates = getOnboardingChecklist({ ...completeInput, enabledLocales: ["pt-PT", "pt-PT"] });
    expect(duplicates.find((item) => item.key === "languages")?.complete).toBe(false);
  });

  it("reports zero percent for an empty checklist", () => {
    expect(onboardingCompletionPercent([])).toBe(0);
  });
});
