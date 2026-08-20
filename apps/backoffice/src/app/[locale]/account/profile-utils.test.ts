import { describe, expect, it } from "vitest";

import { normalizeProfileName, validateProfileName } from "./profile-utils";

describe("user profile validation", () => {
  it("normalizes surrounding and repeated whitespace", () => {
    expect(normalizeProfileName("  Ana   Maria  Silva ")).toBe("Ana Maria Silva");
  });

  it("rejects an empty profile name", () => {
    expect(validateProfileName("   ")).toEqual({ ok: false, value: "" });
  });

  it("rejects names longer than 100 characters", () => {
    expect(validateProfileName("a".repeat(101)).ok).toBe(false);
  });

  it("accepts a normal user name", () => {
    expect(validateProfileName("Bruno Paulon")).toEqual({ ok: true, value: "Bruno Paulon" });
  });
});
