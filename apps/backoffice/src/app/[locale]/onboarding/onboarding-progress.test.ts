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

  it("requires the default locale to remain enabled", () => {
    const items = getOnboardingChecklist({ ...completeInput, enabledLocales: ["en"] });
    expect(items.find((item) => item.key === "languages")?.complete).toBe(false);
  });

  it("reports zero percent for an empty checklist", () => {
    expect(onboardingCompletionPercent([])).toBe(0);
  });
});
