import { describe, expect, it } from "vitest";

import { ModuleNotEnabledError, assertModuleEnabled, hasModule } from "./index";

describe("tenant module entitlements", () => {
  it("accepts enabled and non-expired trial modules", () => {
    const now = new Date("2026-08-16T12:00:00Z");

    expect(hasModule([{ module: "menu", status: "enabled" }], "menu", now)).toBe(true);
    expect(
      hasModule(
        [{ module: "stock", status: "trial", expiresAt: new Date("2026-08-17T12:00:00Z") }],
        "stock",
        now,
      ),
    ).toBe(true);
  });

  it("rejects disabled or expired modules", () => {
    const now = new Date("2026-08-16T12:00:00Z");

    expect(hasModule([{ module: "ai", status: "disabled" }], "ai", now)).toBe(false);
    expect(
      hasModule(
        [{ module: "ai", status: "trial", expiresAt: new Date("2026-08-15T12:00:00Z") }],
        "ai",
        now,
      ),
    ).toBe(false);
    expect(() => assertModuleEnabled([], "ai", now)).toThrow(ModuleNotEnabledError);
  });
});
