import { describe, expect, it } from "vitest";

import { onboardingDraftKey, parseOnboardingDraft, serializeOnboardingDraft } from "./onboarding-draft";

const fields = {
  publicName: "Mandy's Bistro",
  slug: "mandys-bistro",
  locationName: "Principal",
  countryCode: "PT",
  timezone: "Europe/Lisbon",
  currency: "EUR",
  enabledLocales: ["pt-PT", "en"] as const,
};

describe("resumable onboarding draft", () => {
  it("round-trips a valid user-scoped draft", () => {
    const now = 1_700_000_000_000;
    const raw = serializeOnboardingDraft({ ...fields, enabledLocales: [...fields.enabledLocales] }, now);
    expect(parseOnboardingDraft(raw, now + 1_000)).toEqual({ ...fields, enabledLocales: [...fields.enabledLocales] });
    expect(onboardingDraftKey("user-123")).toBe("mandys:onboarding-draft:v1:user-123");
  });

  it("expires drafts after seven days", () => {
    const now = 1_700_000_000_000;
    const raw = serializeOnboardingDraft({ ...fields, enabledLocales: [...fields.enabledLocales] }, now);
    expect(parseOnboardingDraft(raw, now + 7 * 24 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  it("rejects malformed and unsupported drafts", () => {
    expect(parseOnboardingDraft("not-json")).toBeNull();
    expect(parseOnboardingDraft(JSON.stringify({ version: 99, expiresAt: Date.now() + 1000, fields }))).toBeNull();
  });

  it("rejects drafts without a supported language", () => {
    const raw = JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 10_000,
      fields: { ...fields, enabledLocales: ["xx"] },
    });
    expect(parseOnboardingDraft(raw)).toBeNull();
  });
});
